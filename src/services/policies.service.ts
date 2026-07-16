import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

function generatePolicyNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POL-${ts}-${rand}`;
}

export async function purchasePolicy(farmerId: string, tenantId: string, data: { policyPlanId: string; landParcelId: string; startDate: string }) {
  const parcel = await prisma.landParcel.findFirst({
    where: { id: data.landParcelId, tenantId },
  });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Land parcel does not belong to you", 403);

  const plan = await prisma.policyPlan.findFirst({
    where: { id: data.policyPlanId, tenantId },
  });
  if (!plan) throw new AppError("Policy plan not found", 404);
  if (!plan.isActive) throw new AppError("Policy plan is no longer active", 400);

  const coverageAmount = plan.coveragePerAcre * parcel.areaAcres;
  const premiumAmount = plan.premiumRate * coverageAmount;
  const startDate = new Date(data.startDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + plan.termMonths);

  return prisma.policy.create({
    data: {
      policyNumber: generatePolicyNumber(), tenantId, farmerId, landParcelId: data.landParcelId,
      policyPlanId: data.policyPlanId, coverageAmount, premiumAmount,
      startDate, endDate, status: "ACTIVE",
    },
  });
}

export async function listFarmerPolicies(farmerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [policies, total] = await Promise.all([
    prisma.policy.findMany({ where: { farmerId }, skip, take: limit, orderBy: { createdAt: "desc" }, include: { policyPlan: true, landParcel: true } }),
    prisma.policy.count({ where: { farmerId } }),
  ]);
  return { policies, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPolicy(policyId: string, tenantId: string) {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, tenantId },
    include: { policyPlan: true, landParcel: true, farmer: true, claims: true, payments: true },
  });
  if (!policy) throw new AppError("Policy not found", 404);
  return policy;
}
