import { z } from "zod";
export const createClaimSchema = z.object({ policyId: z.string().uuid(), incidentType: z.string().min(1), incidentDate: z.string().datetime(), incidentLocation: z.string().optional(), description: z.string().min(1), estimatedLossPercentage: z.number().min(0).max(100).optional(), claimedAmount: z.number().positive() });
export const assignClaimSchema = z.object({ claimsOfficerId: z.string().uuid() });
export const updateClaimStatusSchema = z.object({ status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]), approvedAmount: z.number().positive().optional(), rejectionReason: z.string().optional(), note: z.string().optional() });
export const listClaimsQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), status: z.string().optional() });
