import { z } from "zod";
export const createStaffUserSchema = z.object({ email: z.string().email(), role: z.enum(["UNDERWRITER", "CLAIMS_OFFICER", "FIELD_AGENT", "ADMIN"]), phone: z.string().optional() });
export const listUsersQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), role: z.string().optional() });
