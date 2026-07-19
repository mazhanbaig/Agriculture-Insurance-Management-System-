import { z } from "zod";

export const createStaffUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["UNDERWRITER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "FIELD_AGENT", "TENANT_ADMIN"]),
  phone: z.string().optional(),
});
