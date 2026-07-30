import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";
import logger from "../utils/logger";

export async function scheduleVisit(
  claimId: string,
  tenantId: string,
  assignedToId: string,
  scheduledDate: Date,
  notes?: string
) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, tenantId } });
  if (!claim) throw new AppError("Claim not found", 404);

  const visit = await prisma.visit.create({
    data: { claimId, tenantId, assignedToId, scheduledDate, notes: notes || null },
  });

  await notificationQueue.add("visit-scheduled", {
    userId: assignedToId,
    type: "VISIT_SCHEDULED",
    title: "Field Visit Scheduled",
    message: `A field visit has been scheduled for claim ${claim.claimNumber} on ${scheduledDate.toISOString()}`,
    relatedEntityType: "Visit",
    relatedEntityId: visit.id,
  });

  logger.info({ visitId: visit.id, claimId, assignedToId, scheduledDate }, "Visit scheduled");
  return visit;
}

export async function completeVisit(
  visitId: string,
  data: {
    locationLat?: number;
    locationLng?: number;
    locationAddress?: string;
    notes?: string;
    reportUrl?: string;
    damagePercent?: number;
  }
) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new AppError("Visit not found", 404);

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      locationLat: data.locationLat,
      locationLng: data.locationLng,
      locationAddress: data.locationAddress,
      notes: data.notes,
      reportUrl: data.reportUrl,
    },
  });

  if (data.damagePercent !== undefined) {
    await prisma.damageAssessment.create({
      data: {
        claimId: visit.claimId,
        tenantId: visit.tenantId,
        groundTruthDamagePercent: data.damagePercent,
        assessedAt: new Date(),
      },
    });
  }

  await notificationQueue.add("visit-completed", {
    userId: visit.assignedToId,
    type: "VISIT_COMPLETED",
    title: "Field Visit Completed",
    message: `Field visit ${visitId.slice(0, 8)} has been marked complete`,
    relatedEntityType: "Visit",
    relatedEntityId: visitId,
  });

  logger.info({ visitId, damagePercent: data.damagePercent }, "Visit completed");
  return updated;
}

export async function listVisits(
  tenantId: string,
  claimId?: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId };
  if (claimId) where.claimId = claimId;
  if (status) where.status = status;

  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledDate: "desc" },
      include: {
        claim: { select: { claimNumber: true, status: true } },
      },
    }),
    prisma.visit.count({ where }),
  ]);

  return { items: visits, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function cancelVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new AppError("Visit not found", 404);

  return prisma.visit.update({
    where: { id: visitId },
    data: { status: "CANCELLED" },
  });
}
