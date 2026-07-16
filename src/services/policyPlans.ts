import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { redis } from "../lib/redis";

const POLICY_PLANS_CACHE_KEY = "policy-plans:active";
const POLICY_PLANS_CACHE_TTL = 300;

export async function listPolicyPlans(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [plans, total] = await Promise.all([
    prisma.policyPlan.findMany({ where: { isActive: true }, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.policyPlan.count({ where: { isActive: true } }),
  ]);
  return { plans, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPolicyPlan(planId: string) {
  const plan = await prisma.policyPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError("Policy plan not found", 404);
  return plan;
}

export async function createPolicyPlan(data: any) {
  const plan = await prisma.policyPlan.create({ data });
  await redis.del(POLICY_PLANS_CACHE_KEY);
  return plan;
}

export async function updatePolicyPlan(planId: string, data: any) {
  const plan = await prisma.policyPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError("Policy plan not found", 404);
  const updated = await prisma.policyPlan.update({ where: { id: planId }, data });
  await redis.del(POLICY_PLANS_CACHE_KEY);
  return updated;
}

export async function calculateQuote(policyPlanId: string, areaAcres: number, termMonths?: number) {
  const plan = await prisma.policyPlan.findUnique({ where: { id: policyPlanId } });
  if (!plan) throw new AppError("Policy plan not found", 404);
  if (!plan.isActive) throw new AppError("Policy plan is no longer active", 400);
  if (plan.minAreaAcres && areaAcres < plan.minAreaAcres) throw new AppError(`Minimum area required is ${plan.minAreaAcres} acres`, 400);
  if (plan.maxAreaAcres && areaAcres > plan.maxAreaAcres) throw new AppError(`Maximum area allowed is ${plan.maxAreaAcres} acres`, 400);
  const coverageAmount = plan.coveragePerAcre * areaAcres;
  const premiumAmount = plan.premiumRate * coverageAmount;
  const duration = termMonths || plan.termMonths;
  return { policyPlanId: plan.id, planName: plan.name, areaAcres, coveragePerAcre: plan.coveragePerAcre, coverageAmount, premiumRate: plan.premiumRate, premiumAmount, termMonths: duration };
}

function generatePolicyNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POL-${timestamp}-${random}`;
}

export async function purchasePolicy(farmerId: string, data: { policyPlanId: string; landParcelId: string; startDate: string }) {
  const parcel = await prisma.landParcel.findUnique({ where: { id: data.landParcelId } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Land parcel does not belong to you", 403);
  const plan = await prisma.policyPlan.findUnique({ where: { id: data.policyPlanId } });
  if (!plan) throw new AppError("Policy plan not found", 404);
  if (!plan.isActive) throw new AppError("Policy plan is no longer active", 400);
  const coverageAmount = plan.coveragePerAcre * parcel.areaAcres;
  const premiumAmount = plan.premiumRate * coverageAmount;
  const startDate = new Date(data.startDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + plan.termMonths);
  return prisma.policy.create({
    data: { policyNumber: generatePolicyNumber(), farmerId, landParcelId: data.landParcelId, policyPlanId: data.policyPlanId, coverageAmount, premiumAmount, startDate, endDate, status: "ACTIVE" },
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

export async function getPolicy(policyId: string) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: { policyPlan: true, landParcel: true, farmer: true, claims: true, payments: true },
  });
  if (!policy) throw new AppError("Policy not found", 404);
  return policy;
}
