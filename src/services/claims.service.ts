import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";
import { runSyncForensics, enqueueAsyncFraudAnalysis } from "./fraud.service";

function generateClaimNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CLM-${ts}-${rand}`;
}

export async function createClaim(farmerId: string, tenantId: string, userId: string, data: {
  policyId: string; incidentType: string; incidentDate: string;
  incidentLocation?: string; description: string;
  estimatedLossPercentage?: number; claimedAmount: number;
}) {
  const policy = await prisma.policy.findFirst({
    where: { id: data.policyId, tenantId },
  });
  if (!policy) throw new AppError("Policy not found", 404);
  if (policy.farmerId !== farmerId) throw new AppError("Policy does not belong to you", 403);
  if (policy.status !== "ACTIVE") throw new AppError("Cannot file a claim on a non-active policy", 400);

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const duplicate = await prisma.claim.findFirst({ where: { policyId: data.policyId, tenantId, incidentDate: { gte: thirtyDaysAgo } } });
  if (duplicate) throw new AppError("A claim for this policy was submitted within the last 30 days", 409);

  const claim = await prisma.claim.create({
    data: {
      claimNumber: generateClaimNumber(), tenantId, policyId: data.policyId, farmerId,
      incidentType: data.incidentType, incidentDate: new Date(data.incidentDate),
      incidentLocation: data.incidentLocation, description: data.description,
      estimatedLossPercentage: data.estimatedLossPercentage, claimedAmount: data.claimedAmount,
      status: "SUBMITTED",
    },
  });

  await prisma.claimStatusHistory.create({ data: { claimId: claim.id, fromStatus: "SUBMITTED", toStatus: "SUBMITTED", changedByUserId: userId, note: "Claim submitted" } });
  await notificationQueue.add("claim-submitted", { userId, type: "CLAIM_SUBMITTED", title: "Claim Submitted", message: `Claim ${claim.claimNumber} has been submitted.`, relatedEntityType: "Claim", relatedEntityId: claim.id });

  // Run sync forensic checks (fast, < 100ms)
  try {
    await runSyncForensics(claim.id, tenantId, farmerId, {
      policyId: data.policyId,
      incidentDate: data.incidentDate,
      claimedAmount: data.claimedAmount,
      estimatedLossPercentage: data.estimatedLossPercentage,
    });
  } catch (forensicError) {
    // Don't block claim creation if forensics fail
    console.error("Sync forensics failed:", forensicError);
  }

  // Enqueue async fraud analysis (AI checks, satellite, weather)
  try {
    await enqueueAsyncFraudAnalysis(claim.id, tenantId);
  } catch (enqueueError) {
    console.error("Failed to enqueue fraud analysis:", enqueueError);
  }

  return claim;
}

export async function listFarmerClaims(farmerId: string, tenantId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { farmerId, tenantId };
  if (status) where.status = status;
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" }, include: { policy: { include: { policyPlan: true } }, documents: true, statusHistory: { orderBy: { changedAt: "desc" } } } }),
    prisma.claim.count({ where }),
  ]);
  return { claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getClaim(claimId: string, tenantId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId },
    include: { policy: { include: { policyPlan: true, landParcel: true } }, documents: true, statusHistory: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { id: true, email: true } } } }, assignedClaimsOfficer: { select: { id: true, email: true } } },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  return claim;
}

export async function assignClaim(claimId: string, tenantId: string, claimsOfficerId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  return prisma.claim.update({ where: { id: claimId }, data: { assignedClaimsOfficerId: claimsOfficerId } });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW"], UNDER_REVIEW: ["APPROVED", "REJECTED"],
};

export async function updateClaimStatus(claimId: string, tenantId: string, changedByUserId: string, data: { status: string; approvedAmount?: number; rejectionReason?: string; note?: string }) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  const allowed = VALID_TRANSITIONS[claim.status];
  if (!allowed || !allowed.includes(data.status)) throw new AppError(`Cannot transition from ${claim.status} to ${data.status}`, 400);

  const updateData: Record<string, any> = { status: data.status };
  if (data.status === "APPROVED") { updateData.approvedAmount = data.approvedAmount; updateData.resolvedAt = new Date(); }
  if (data.status === "REJECTED") { updateData.rejectionReason = data.rejectionReason; updateData.resolvedAt = new Date(); }

  const updated = await prisma.claim.update({ where: { id: claimId }, data: updateData });
  await prisma.claimStatusHistory.create({ data: { claimId, fromStatus: claim.status, toStatus: data.status, changedByUserId, note: data.note } });
  await notificationQueue.add("claim-status-changed", { userId: claim.farmerId, type: "CLAIM_STATUS_CHANGED", title: `Claim ${data.status}`, message: `Claim ${claim.claimNumber} has been ${data.status.toLowerCase()}.`, relatedEntityType: "Claim", relatedEntityId: claim.id });
  return updated;
}

export async function listAllClaims(tenantId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId };
  if (status) where.status = status;
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" }, include: { farmer: { select: { id: true, fullName: true } }, policy: { include: { policyPlan: { select: { name: true } } } }, assignedClaimsOfficer: { select: { id: true, email: true } } } }),
    prisma.claim.count({ where }),
  ]);
  return { claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
