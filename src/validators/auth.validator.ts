import { z } from "zod";

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["FARMER", "UNDERWRITER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "FIELD_AGENT", "TENANT_ADMIN", "PLATFORM_ADMIN"]),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["FARMER", "UNDERWRITER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "FIELD_AGENT", "TENANT_ADMIN", "PLATFORM_ADMIN"]),
  tenantSlug: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const oauthCallbackSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().optional(),
  avatar: z.string().optional(),
  provider: z.enum(["google", "github"]),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
});

export const oauthSetupSchema = z.object({
  role: z.enum(["FARMER", "UNDERWRITER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "FIELD_AGENT", "TENANT_ADMIN", "PLATFORM_ADMIN"]),
  tenantSlug: z.string().optional(),
  phone: z.string().optional(),
});
