import { z } from "zod";

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["FARMER", "UNDERWRITER", "CLAIMS_OFFICER", "FIELD_AGENT", "ADMIN"]),
});
