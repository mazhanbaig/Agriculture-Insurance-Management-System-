import { z } from "zod";
import { PERMISSIONS } from "../config/permissions";

const permissionValues = Object.values(PERMISSIONS) as [string, ...string[]];

export const createCustomRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Name must contain only letters, numbers, underscores, and hyphens",
  }),
  description: z.string().max(200).optional(),
  permissions: z.array(z.enum(permissionValues)).min(1, "At least one permission is required"),
});

export const updateCustomRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  description: z.string().max(200).optional().nullable(),
  permissions: z.array(z.enum(permissionValues)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const assignCustomRoleSchema = z.object({
  userId: z.string().uuid(),
  customRoleId: z.string().uuid().nullable(),
});
