import { z } from "zod";

export const updateSettingsSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  config: z.record(z.string(), z.any()).optional(),
  name: z.string().min(1).max(100).optional(),
});
