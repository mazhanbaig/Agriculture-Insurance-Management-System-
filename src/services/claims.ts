import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";

function generateClaimNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CLM-${timestamp}-${random}`;
}

export async function createClaim(farmerId: string, userId: string, data: any) {
  const policy = await prisma.policy.findUnique({ where: { id: data.policyId } });
  if (!policy) throw new AppError("Policy not found", 404);
  if (policy.farmerId !== farmerId) throw new AppError("Policy does not belong to you", 403);
  if (policy.status !== "ACTIVE") throw new AppError("Cannot file a claim on a non-active policy", 400);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const duplicate = await prisma.claim.findFirst({ where: { policyId: data.policyId, incidentDate: { gte: thirtyDaysAgo } } });
  if (duplicate) throw new AppError("A claim for this policy has already been submitted within the last 30 days", 409);

  const claim = await prisma.claim.create({
    data: { claimNumber: generateClaimNumber(), policyId: data.policyId, farmerId, incidentType: data.incidentType, incidentDate: new Date(data.incidentDate), incidentLocation: data.incidentLocation, description: data.description, estimatedLossPercentage: data.estimatedLossPercentage, claimedAmount: data.claimedAmount, status: "SUBMITTED" },
  });

  await prisma.claimStatusHistory.create({ data: { claimId: claim.id, fromStatus: "SUBMITTED", toStatus: "SUBMITTED", changedByUserId: userId, note: "Claim submitted" } });
  await notificationQueue.add("claim-submitted", { userId, type: "CLAIM_SUBMITTED", title: "Claim Submitted", message: `Claim ${claim.claimNumber} has been submitted successfully.`, relatedEntityType: "Claim", relatedEntityId: claim.id });
  return claim;
}

export async function listClaims(farmerId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: any = { farmerId };
  if (status) where.status = status;
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" }, include: { policy: { include: { policyPlan: true } }, documents: true, statusHistory: { orderBy: { changedAt: "desc" } } } }),
    prisma.claim.count({ where }),
  ]);
  return { claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { policy: { include: { policyPlan: true, landParcel: true } }, documents: true, statusHistory: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { id: true, email: true } } } }, assignedClaimsOfficer: { select: { id: true, email: true } } },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  return claim;
}

export async function assignClaim(claimId: string, claimsOfficerId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new AppError("Claim not found", 404);
  return prisma.claim.update({ where: { id: claimId }, data: { assignedClaimsOfficerId: claimsOfficerId } });
}

export async function updateClaimStatus(claimId: string, changedByUserId: string, data: { status: string; approvedAmount?: number; rejectionReason?: string; note?: string }) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new AppError("Claim not found", 404);

  const validTransitions: Record<string, string[]> = { SUBMITTED: ["UNDER_REVIEW"], UNDER_REVIEW: ["APPROVED", "REJECTED"] };
  const allowed = validTransitions[claim.status];
  if (!allowed || !allowed.includes(data.status)) throw new AppError(`Cannot transition from ${claim.status} to ${data.status}`, 400);

  const updateData: any = { status: data.status };
  if (data.status === "APPROVED") { updateData.approvedAmount = data.approvedAmount; updateData.resolvedAt = new Date(); }
  if (data.status === "REJECTED") { updateData.rejectionReason = data.rejectionReason; updateData.resolvedAt = new Date(); }

  const updated = await prisma.claim.update({ where: { id: claimId }, data: updateData });
  await prisma.claimStatusHistory.create({ data: { claimId, fromStatus: claim.status, toStatus: data.status, changedByUserId, note: data.note } });
  await notificationQueue.add("claim-status-changed", { userId: claim.farmerId, type: "CLAIM_STATUS_CHANGED", title: `Claim ${data.status}`, message: `Claim ${claim.claimNumber} has been ${data.status.toLowerCase()}.`, relatedEntityType: "Claim", relatedEntityId: claim.id });
  return updated;
}

export async function listAllClaims(page: number, limit: number, status?: string, officerId?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (status) where.status = status;
  if (officerId) where.assignedClaimsOfficerId = officerId;
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" }, include: { farmer: { select: { id: true, fullName: true } }, policy: { include: { policyPlan: { select: { name: true } } } }, assignedClaimsOfficer: { select: { id: true, email: true } } } }),
    prisma.claim.count({ where }),
  ]);
  return { claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
