import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";
import logger from "../utils/logger";

function generatePolicyNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POL-${ts}-${rand}`;
}

/**
 * Farmer submits a purchase request (not a completed purchase).
 * No payment happens — the farmer requests to be contacted.
 */
export async function createPolicyRequest(
  farmerId: string,
  tenantId: string,
  data: { policyPlanId: string; landParcelId: string }
) {
  // Verify the land parcel belongs to the farmer
  const parcel = await prisma.landParcel.findFirst({
    where: { id: data.landParcelId, tenantId },
  });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Land parcel does not belong to you", 403);

  // Verify the policy plan exists and is active
  const plan = await prisma.policyPlan.findFirst({
    where: { id: data.policyPlanId, tenantId },
  });
  if (!plan) throw new AppError("Policy plan not found", 404);
  if (!plan.isActive) throw new AppError("Policy plan is no longer active", 400);

  // Check for existing pending request (avoid duplicates)
  const existingPending = await prisma.policyRequest.findFirst({
    where: {
      farmerId,
      policyPlanId: data.policyPlanId,
      landParcelId: data.landParcelId,
      status: "PENDING",
    },
  });
  if (existingPending) {
    throw new AppError("You already have a pending request for this plan and land parcel", 409);
  }

  const request = await prisma.policyRequest.create({
    data: {
      tenantId,
      farmerId,
      landParcelId: data.landParcelId,
      policyPlanId: data.policyPlanId,
      status: "PENDING",
    },
    include: {
      policyPlan: { select: { name: true } },
      landParcel: { select: { address: true } },
    },
  });

  // Notify tenant admins and underwriters about the new request
  const staffUsers = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ["TENANT_ADMIN", "UNDERWRITER"] },
      isActive: true,
    },
    select: { id: true },
  });

  for (const staff of staffUsers) {
    await notificationQueue.add("policy-request-created", {
      userId: staff.id,
      type: "POLICY_REQUEST_CREATED",
      title: "New Policy Purchase Request",
      message: `A farmer has requested to purchase "${request.policyPlan.name}" for ${request.landParcel.address}.`,
      relatedEntityType: "PolicyRequest",
      relatedEntityId: request.id,
    });
  }

  logger.info({ requestId: request.id, farmerId, tenantId }, "Policy purchase request created");
  return request;
}

/**
 * List policy requests.
 * Farmers see only their own; staff see all requests in their tenant.
 */
export async function listPolicyRequests(
  userId: string,
  userRole: string,
  tenantId: string,
  page: number,
  limit: number,
  status?: string
) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId };

  // Farmers can only see their own requests
  if (userRole === "FARMER") {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer) throw new AppError("Farmer profile not found", 400);
    where.farmerId = farmer.id;
  }

  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.policyRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        farmer: { select: { id: true, fullName: true, cnicNumber: true } },
        policyPlan: { select: { id: true, name: true, coveragePerAcre: true, premiumRate: true } },
        landParcel: { select: { id: true, address: true, areaAcres: true, cropType: true } },
        reviewedBy: { select: { id: true, email: true } },
        convertedPolicy: { select: { id: true, policyNumber: true, status: true } },
      },
    }),
    prisma.policyRequest.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a single policy request by ID.
 */
export async function getPolicyRequest(requestId: string, tenantId: string) {
  const request = await prisma.policyRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      farmer: { select: { id: true, fullName: true, cnicNumber: true, phone: true } },
      policyPlan: true,
      landParcel: true,
      reviewedBy: { select: { id: true, email: true, role: true } },
      convertedPolicy: {
        include: {
          policyPlan: { select: { name: true } },
          landParcel: { select: { address: true } },
        },
      },
    },
  });
  if (!request) throw new AppError("Policy request not found", 404);
  return request;
}

/**
 * Approve or reject a policy request (UNDERWRITER / TENANT_ADMIN).
 */
export async function reviewPolicyRequest(
  requestId: string,
  tenantId: string,
  reviewerUserId: string,
  data: { status: "APPROVED" | "REJECTED"; reviewNote?: string }
) {
  const request = await prisma.policyRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { farmer: { select: { userId: true, fullName: true } } },
  });
  if (!request) throw new AppError("Policy request not found", 404);
  if (request.status !== "PENDING") {
    throw new AppError(`Cannot review a request that is already ${request.status}`, 400);
  }

  const updated = await prisma.policyRequest.update({
    where: { id: requestId },
    data: {
      status: data.status,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote,
    },
  });

  // Notify the farmer
  await notificationQueue.add("policy-request-reviewed", {
    userId: request.farmer.userId,
    type: "POLICY_REQUEST_REVIEWED",
    title: `Request ${data.status === "APPROVED" ? "Approved" : "Declined"}`,
    message:
      data.status === "APPROVED"
        ? `Your request to purchase ${request.farmer.fullName}'s policy has been approved. Please visit the office to finalize.`
        : `Your policy purchase request has been declined.${data.reviewNote ? ` Reason: ${data.reviewNote}` : ""}`,
    relatedEntityType: "PolicyRequest",
    relatedEntityId: request.id,
  });

  logger.info({ requestId, status: data.status, reviewerUserId }, "Policy request reviewed");
  return updated;
}

/**
 * Convert an approved policy request into a real Policy.
 * This happens when the farmer visits the office and staff finalizes it.
 */
export async function convertPolicyRequest(
  requestId: string,
  tenantId: string,
  staffUserId: string
) {
  const request = await prisma.policyRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      policyPlan: true,
      landParcel: true,
      farmer: { select: { userId: true, fullName: true } },
    },
  });
  if (!request) throw new AppError("Policy request not found", 404);
  if (request.status !== "APPROVED") {
    throw new AppError("Only approved requests can be converted to policies", 400);
  }
  if (request.convertedPolicyId) {
    throw new AppError("This request has already been converted to a policy", 409);
  }

  // Calculate coverage and premium
  const coverageAmount = request.policyPlan.coveragePerAcre * request.landParcel.areaAcres;
  const premiumAmount = request.policyPlan.premiumRate * coverageAmount;
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + request.policyPlan.termMonths);

  // Create the Policy and mark the request as CONVERTED in a transaction
  const result = await prisma.$transaction(async (tx: any) => {
    const policy = await tx.policy.create({
      data: {
        policyNumber: generatePolicyNumber(),
        tenantId,
        farmerId: request.farmerId,
        landParcelId: request.landParcelId,
        policyPlanId: request.policyPlanId,
        underwriterId: staffUserId,
        coverageAmount,
        premiumAmount,
        premiumPaid: false,
        startDate,
        endDate,
        status: "ACTIVE",
      },
    });

    await tx.policyRequest.update({
      where: { id: requestId },
      data: {
        status: "CONVERTED",
        convertedPolicyId: policy.id,
        reviewedByUserId: staffUserId,
        reviewedAt: new Date(),
      },
    });

    return policy;
  });

  // Notify the farmer
  await notificationQueue.add("policy-request-converted", {
    userId: request.farmer.userId,
    type: "POLICY_CONVERTED",
    title: "Policy Activated",
    message: `Your policy ${result.policyNumber} is now active. Coverage: ${coverageAmount}.`,
    relatedEntityType: "Policy",
    relatedEntityId: result.id,
  });

  logger.info(
    { requestId, policyId: result.id, policyNumber: result.policyNumber, staffUserId },
    "Policy request converted to active policy"
  );

  return result;
}
