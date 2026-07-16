import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { AppError } from "../middleware/errorHandler";

export async function createStaffUser(tenantId: string, data: { email: string; role: string; phone?: string }) {
  const existing = await prisma.user.findFirst({ where: { email: data.email, tenantId } });
  if (existing) throw new AppError("User with this email already exists in this tenant", 409);
  return prisma.user.create({ data: { tenantId, email: data.email, authId: `staff-${tenantId}-${Date.now()}`, role: data.role as any, phone: data.phone } });
}

export async function listStaffUsers(tenantId: string, page: number, limit: number, role?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId, role: { not: "FARMER" } };
  if (role) where.role = role;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, lastLoginAt: true } }),
    prisma.user.count({ where }),
  ]);
  return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function toggleUserStatus(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new AppError("User not found", 404);
  return prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
}

export async function getDashboardAggregates(tenantId: string) {
  const cacheKey = `admin:dashboard:${tenantId}`;
  try { const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); } catch {}

  const where = { tenantId };
  const [totalFarmers, totalPolicies, activePolicies, totalClaims, pendingClaims, approvedClaims, totalPremiumCollected, totalPayouts] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.policy.count({ where }),
    prisma.policy.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.claim.count({ where }),
    prisma.claim.count({ where: { ...where, status: "SUBMITTED" } }),
    prisma.claim.count({ where: { ...where, status: "APPROVED" } }),
    prisma.payment.aggregate({ where: { ...where, type: "PREMIUM", status: "completed" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...where, type: "PAYOUT", status: "completed" }, _sum: { amount: true } }),
  ]);

  const dashboard = {
    totalFarmers, totalPolicies, activePolicies, totalClaims,
    pendingClaims, approvedClaims,
    totalPremiumCollected: totalPremiumCollected._sum.amount || 0,
    totalPayouts: totalPayouts._sum.amount || 0,
  };

  try { await redis.setex(cacheKey, 300, JSON.stringify(dashboard)); } catch {}
  return dashboard;
}

export async function getClaimsAnalytics(tenantId: string) {
  const where = { tenantId };
  const [claimsByStatus, claimsByIncidentType] = await Promise.all([
    prisma.claim.groupBy({ by: ["status"], where, _count: { id: true } }),
    prisma.claim.groupBy({ by: ["incidentType"], where, _count: { id: true } }),
  ]);
  return { claimsByStatus, claimsByIncidentType };
}
