import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export async function listPolicyPlans(tenantId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const where = { tenantId, isActive: true };
  const [plans, total] = await Promise.all([
    prisma.policyPlan.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.policyPlan.count({ where }),
  ]);
  return { plans, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPolicyPlan(planId: string, tenantId: string) {
  const plan = await prisma.policyPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new AppError("Policy plan not found", 404);
  return plan;
}

export async function createPolicyPlan(tenantId: string, data: {
  name: string; cropType: string; coveragePerAcre: number; premiumRate: number;
  minAreaAcres?: number; maxAreaAcres?: number; termMonths: number; description?: string;
}) {
  return prisma.policyPlan.create({ data: { tenantId, ...data } });
}

export async function updatePolicyPlan(planId: string, tenantId: string, data: Record<string, any>) {
  const plan = await prisma.policyPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new AppError("Policy plan not found", 404);
  return prisma.policyPlan.update({ where: { id: planId }, data });
}

export async function calculateQuote(policyPlanId: string, tenantId: string, areaAcres: number, termMonths?: number) {
  const plan = await prisma.policyPlan.findFirst({
    where: { id: policyPlanId, tenantId },
  });
  if (!plan) throw new AppError("Policy plan not found", 404);
  if (!plan.isActive) throw new AppError("Policy plan is no longer active", 400);
  if (plan.minAreaAcres && areaAcres < plan.minAreaAcres) throw new AppError(`Minimum area required is ${plan.minAreaAcres} acres`, 400);
  if (plan.maxAreaAcres && areaAcres > plan.maxAreaAcres) throw new AppError(`Maximum area allowed is ${plan.maxAreaAcres} acres`, 400);

  return {
    policyPlanId: plan.id, planName: plan.name, areaAcres,
    coveragePerAcre: plan.coveragePerAcre,
    coverageAmount: plan.coveragePerAcre * areaAcres,
    premiumRate: plan.premiumRate,
    premiumAmount: plan.premiumRate * plan.coveragePerAcre * areaAcres,
    termMonths: termMonths || plan.termMonths,
  };
}
