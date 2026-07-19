import { z } from "zod";

export const updateSettingsSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  config: z.record(z.string(), z.any()).optional(),
  name: z.string().min(1).max(100).optional(),
});

export const updateFraudTierSchema = z.object({
  tier: z.enum(["forge", "titan", "goat"]),
});

export const updatePaymentGatewaySchema = z.object({
  gateway: z.enum(["stripe", "easypaisa", "jazzcash"]),
  currency: z.string().min(3).max(5).optional(),
});
