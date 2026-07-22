import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  adminEmail: z.string().email(),
  logoUrl: z.string().url().optional(),
  billingEnabled: z.boolean().optional(),
});

export const signupTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  adminEmail: z.string().email(),
  logoUrl: z.string().url().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  logoUrl: z.union([z.string().url(), z.null()]).optional(),
  config: z.record(z.string(), z.any()).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  billingEnabled: z.boolean().optional(),
});

export const seedPlansSchema = z.object({
  plans: z.array(z.object({
    name: z.string().min(1),
    cropType: z.string().min(1),
    coveragePerAcre: z.number().positive(),
    premiumRate: z.number().positive(),
    minAreaAcres: z.number().positive().optional(),
    maxAreaAcres: z.number().positive().optional(),
    termMonths: z.number().int().positive(),
    description: z.string().optional(),
  })).min(1),
});
