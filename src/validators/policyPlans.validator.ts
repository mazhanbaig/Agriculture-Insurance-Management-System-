import { z } from "zod";

const autoTriggerConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  ndviThreshold: z.number().min(0).max(1).optional().default(0.3),
  weatherCheck: z.boolean().optional().default(true),
  minDaysBetweenChecks: z.number().int().min(0).optional().default(1),
  claimPercentage: z.number().min(0).max(1).optional().default(0.5),
  maxRetries: z.number().int().min(0).optional().default(3),
  retryBaseDelayMs: z.number().int().min(0).optional().default(2000),
  autoApprove: z.boolean().optional().default(true),
  autoApproveMaxScore: z.number().int().min(0).max(100).optional().default(30),
});

export const createPolicyPlanSchema = z.object({
  name: z.string().min(1),
  cropType: z.string().min(1),
  coveragePerAcre: z.number().positive(),
  premiumRate: z.number().positive(),
  minAreaAcres: z.number().positive().optional(),
  maxAreaAcres: z.number().positive().optional(),
  termMonths: z.number().int().positive(),
  description: z.string().optional(),
  config: z.object({
    autoTrigger: autoTriggerConfigSchema.optional(),
  }).optional(),
});

export const updatePolicyPlanSchema = z.object({
  name: z.string().min(1).optional(),
  cropType: z.string().min(1).optional(),
  coveragePerAcre: z.number().positive().optional(),
  premiumRate: z.number().positive().optional(),
  minAreaAcres: z.number().positive().optional(),
  maxAreaAcres: z.number().positive().optional(),
  termMonths: z.number().int().positive().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  config: z.object({
    autoTrigger: autoTriggerConfigSchema.optional(),
  }).optional(),
});

export const quotePremiumSchema = z.object({
  policyPlanId: z.string().uuid(),
  areaAcres: z.number().positive(),
  termMonths: z.number().int().positive().optional(),
});
