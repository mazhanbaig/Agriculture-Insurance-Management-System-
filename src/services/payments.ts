import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

export async function createPremiumPayment(policyId: string) {
  const policy = await prisma.policy.findUnique({ where: { id: policyId }, include: { farmer: true } });
  if (!policy) throw new AppError("Policy not found", 404);
  if (policy.premiumPaid) throw new AppError("Premium already paid for this policy", 400);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(policy.premiumAmount * 100), currency: "usd",
    metadata: { policyId: policy.id, type: "PREMIUM" },
  });

  const payment = await prisma.payment.create({
    data: { policyId: policy.id, type: "PREMIUM", amount: policy.premiumAmount, gatewayTransactionId: paymentIntent.id, status: "pending" },
  });
  return { clientSecret: paymentIntent.client_secret, payment };
}

export async function confirmPremiumPayment(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") throw new AppError("Payment not completed", 400);
  const policyId = paymentIntent.metadata.policyId;
  if (!policyId) throw new AppError("Invalid payment metadata", 400);

  await prisma.payment.updateMany({ where: { gatewayTransactionId: paymentIntentId }, data: { status: "completed", paidAt: new Date() } });
  return prisma.policy.update({ where: { id: policyId }, data: { premiumPaid: true, paymentDate: new Date() } });
}

export async function processPayout(claimId: string, amount: number) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { farmer: true, policy: true } });
  if (!claim) throw new AppError("Claim not found", 404);
  if (claim.status !== "APPROVED") throw new AppError("Claim must be approved before payout", 400);

  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), currency: "usd",
    destination: process.env.STRIPE_CONNECT_ACCOUNT || "default",
    metadata: { claimId: claim.id, type: "PAYOUT" },
  });

  const payment = await prisma.payment.create({
    data: { claimId: claim.id, type: "PAYOUT", amount, gatewayTransactionId: transfer.id, status: "completed", paidAt: new Date() },
  });
  await prisma.claim.update({ where: { id: claimId }, data: { status: "PAID" } });
  return payment;
}

export async function getPaymentsForPolicy(policyId: string) {
  return prisma.payment.findMany({ where: { policyId }, orderBy: { createdAt: "desc" } });
}

export async function getPaymentsForClaim(claimId: string) {
  return prisma.payment.findMany({ where: { claimId }, orderBy: { createdAt: "desc" } });
}
