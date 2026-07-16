import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { AppError } from "../middleware/errorHandler";

const DASHBOARD_CACHE_KEY = "admin:dashboard";
const DASHBOARD_CACHE_TTL = 300;

export async function createStaffUser(data: { email: string; role: string; phone?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError("User with this email already exists", 409);
  return prisma.user.create({ data: { email: data.email, authId: `staff-${Date.now()}`, role: data.role as any, phone: data.phone } });
}

export async function listStaffUsers(page: number, limit: number, role?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { role: { not: "FARMER" } };
  if (role) where.role = role;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, lastLoginAt: true } }),
    prisma.user.count({ where }),
  ]);
  return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function toggleUserStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);
  return prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
}

export async function getDashboardAggregates() {
  try { const cached = await redis.get(DASHBOARD_CACHE_KEY); if (cached) return JSON.parse(cached); } catch {}
  const [totalFarmers, totalPolicies, activePolicies, totalClaims, pendingClaims, approvedClaims, totalPremiumCollected, totalPayouts] = await Promise.all([
    prisma.farmer.count(), prisma.policy.count(), prisma.policy.count({ where: { status: "ACTIVE" } }),
    prisma.claim.count(), prisma.claim.count({ where: { status: "SUBMITTED" } }), prisma.claim.count({ where: { status: "APPROVED" } }),
    prisma.payment.aggregate({ where: { type: "PREMIUM", status: "completed" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { type: "PAYOUT", status: "completed" }, _sum: { amount: true } }),
  ]);
  const dashboard = { totalFarmers, totalPolicies, activePolicies, totalClaims, pendingClaims, approvedClaims, totalPremiumCollected: totalPremiumCollected._sum.amount || 0, totalPayouts: totalPayouts._sum.amount || 0 };
  try { await redis.setex(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TTL, JSON.stringify(dashboard)); } catch {}
  return dashboard;
}

export async function getClaimsAnalytics() {
  const [claimsByStatus, claimsByIncidentType] = await Promise.all([
    prisma.claim.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.claim.groupBy({ by: ["incidentType"], _count: { id: true } }),
  ]);
  return { claimsByStatus, claimsByIncidentType };
}
