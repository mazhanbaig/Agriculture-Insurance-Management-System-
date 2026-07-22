import { z } from "zod";

export const createPolicyRequestSchema = z.object({
  policyPlanId: z.string().uuid(),
  landParcelId: z.string().uuid(),
});

export const reviewPolicyRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

export const listPolicyRequestsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CONVERTED"]).optional(),
});
