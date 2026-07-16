import { z } from "zod";

export const importPolicyPlansSchema = z.object({
  format: z.enum(["csv", "json"]),
  data: z.string().min(1, "Data payload is required"),
  columnMapping: z.record(z.string(), z.string()).optional(),
});

export const importFarmersPoliciesSchema = z.object({
  format: z.enum(["csv", "json"]),
  data: z.string().min(1, "Data payload is required"),
  columnMapping: z.record(z.string(), z.string()).optional(),
});
