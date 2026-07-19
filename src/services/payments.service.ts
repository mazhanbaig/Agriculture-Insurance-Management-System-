import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getPaymentGateway } from "../lib/paymentGatewayFactory";

export async function createPremiumPayment(policyId: string, tenantId: string) {
  const policy = await prisma.policy.findFirst({ where: { id: policyId, tenantId }, include: { farmer: { include: { user: true } } } });
  if (!policy) throw new AppError("Policy not found", 404);
  if (policy.premiumPaid) throw new AppError("Premium already paid", 400);

  const gateway = await getPaymentGateway(tenantId);
  const result = await gateway.createPayment({
    amount: policy.premiumAmount,
    currency: "usd",
    description: `Premium for policy ${policy.policyNumber}`,
    metadata: { policyId: policy.id, type: "PREMIUM" },
    email: policy.farmer.user.email,
  });

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      policyId: policy.id,
      type: "PREMIUM",
      amount: policy.premiumAmount,
      gatewayTransactionId: result.gatewayTransactionId,
      status: result.status,
    },
  });

  return { clientSecret: result.clientSecret, redirectUrl: result.redirectUrl, payment };
}

export async function confirmPremiumPayment(gatewayTransactionId: string, tenantId?: string) {
  // If tenantId is provided, use tenant-specific gateway; otherwise use Stripe default
  const gateway = tenantId
    ? await getPaymentGateway(tenantId)
    : (await import("../lib/paymentGatewayFactory")).getGatewayByType("stripe");

  const verification = await gateway.verifyPayment({ gatewayTransactionId });
  if (!verification.verified) throw new AppError("Payment not completed", 400);

  const payment = await prisma.payment.findFirst({ where: { gatewayTransactionId } });
  if (!payment) throw new AppError("Payment record not found", 404);

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "completed", paidAt: new Date() },
  });

  if (payment.policyId) {
    await prisma.policy.update({
      where: { id: payment.policyId },
      data: { premiumPaid: true, paymentDate: new Date() },
    });
  }

  return payment;
}

export async function processPayout(claimId: string, tenantId: string, amount: number) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId },
    include: { farmer: { include: { user: true } }, policy: true },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  if (claim.status !== "APPROVED") throw new AppError("Claim must be approved before payout", 400);

  const gateway = await getPaymentGateway(tenantId);

  // Determine destination — farmer bank account or phone number
  const farmer = claim.farmer;
  const destination = farmer.bankAccountNumber || farmer.accountTitle || "default";

  const result = await gateway.createPayout({
    amount,
    currency: "usd",
    destination,
    metadata: { claimId: claim.id, type: "PAYOUT", farmerName: farmer.fullName },
  });

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      claimId: claim.id,
      type: "PAYOUT",
      amount,
      gatewayTransactionId: result.gatewayTransactionId,
      status: result.status,
      paidAt: result.status === "completed" ? new Date() : null,
    },
  });

  await prisma.claim.update({ where: { id: claimId }, data: { status: "PAID" } });
  return payment;
}

export async function getPaymentsForPolicy(policyId: string, tenantId: string) {
  return prisma.payment.findMany({ where: { policyId, tenantId }, orderBy: { createdAt: "desc" } });
}

export async function getPaymentsForClaim(claimId: string, tenantId: string) {
  return prisma.payment.findMany({ where: { claimId, tenantId }, orderBy: { createdAt: "desc" } });
}
