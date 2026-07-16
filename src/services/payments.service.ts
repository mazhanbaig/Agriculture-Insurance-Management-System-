import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.", 500);
  }
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

export async function createPremiumPayment(policyId: string, tenantId: string) {
  const policy = await prisma.policy.findFirst({ where: { id: policyId, tenantId }, include: { farmer: true } });
  if (!policy) throw new AppError("Policy not found", 404);
  if (policy.premiumPaid) throw new AppError("Premium already paid", 400);

  const paymentIntent = await getStripe().paymentIntents.create({ amount: Math.round(policy.premiumAmount * 100), currency: "usd", metadata: { policyId: policy.id, type: "PREMIUM" } });
  const payment = await prisma.payment.create({ data: { tenantId, policyId: policy.id, type: "PREMIUM", amount: policy.premiumAmount, gatewayTransactionId: paymentIntent.id, status: "pending" } });
  return { clientSecret: paymentIntent.client_secret, payment };
}

export async function confirmPremiumPayment(paymentIntentId: string) {
  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") throw new AppError("Payment not completed", 400);
  const policyId = paymentIntent.metadata.policyId;
  if (!policyId) throw new AppError("Invalid payment metadata", 400);
  await prisma.payment.updateMany({ where: { gatewayTransactionId: paymentIntentId }, data: { status: "completed", paidAt: new Date() } });
  return prisma.policy.update({ where: { id: policyId }, data: { premiumPaid: true, paymentDate: new Date() } });
}

export async function processPayout(claimId: string, tenantId: string, amount: number) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, tenantId }, include: { farmer: true, policy: true } });
  if (!claim) throw new AppError("Claim not found", 404);
  if (claim.status !== "APPROVED") throw new AppError("Claim must be approved before payout", 400);

  const transfer = await getStripe().transfers.create({ amount: Math.round(amount * 100), currency: "usd", destination: process.env.STRIPE_CONNECT_ACCOUNT || "default", metadata: { claimId: claim.id, type: "PAYOUT" } });
  const payment = await prisma.payment.create({ data: { tenantId, claimId: claim.id, type: "PAYOUT", amount, gatewayTransactionId: transfer.id, status: "completed", paidAt: new Date() } });
  await prisma.claim.update({ where: { id: claimId }, data: { status: "PAID" } });
  return payment;
}

export async function getPaymentsForPolicy(policyId: string, tenantId: string) {
  return prisma.payment.findMany({ where: { policyId, tenantId }, orderBy: { createdAt: "desc" } });
}

export async function getPaymentsForClaim(claimId: string, tenantId: string) {
  return prisma.payment.findMany({ where: { claimId, tenantId }, orderBy: { createdAt: "desc" } });
}
