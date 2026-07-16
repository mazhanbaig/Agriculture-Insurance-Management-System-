import { z } from "zod";

export const createStaffUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["UNDERWRITER", "CLAIMS_OFFICER", "FIELD_AGENT", "ADMIN"]),
  phone: z.string().optional(),
});
