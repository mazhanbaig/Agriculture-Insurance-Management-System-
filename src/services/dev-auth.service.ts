import { prisma } from "../lib/prisma";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";

interface SeedInput {
  name: string;
  email: string;
  role: string;
  phone?: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  farmerId: string | null;
  avatar: string | null;
  accessToken: string;
  token: string;
  authSource: string;
}

interface DevUserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
  createdAt: Date;
  authSource: string;
}

/**
 * Dev-only: Create or retrieve a test user directly via Prisma.
 * Completely bypasses Supabase Auth rate limits.
 */
export async function seedDevUser(data: SeedInput): Promise<UserResponse> {
  const TENANT_SLUG = "default";

  // Resolve tenant — ensure it's ACTIVE
  let tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Default Insurance",
        slug: TENANT_SLUG,
        billingEnabled: false,
        status: "ACTIVE",
      },
    });
  } else if (tenant.status !== "ACTIVE" && tenant.status !== null) {
    // Fix non-active tenant for development
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE" },
    });
  }
  const tenantId = tenant.id;

  // Check if user already exists
  const existing = await prisma.user.findFirst({
    where: { email: data.email, tenantId },
  });

  if (existing) {
    return buildUserResponse(existing.id);
  }

  // Create user directly in Prisma
  const devAuthId = `dev_${randomUUID()}`;
  const user = await prisma.user.create({
    data: {
      tenantId,
      authId: devAuthId,
      email: data.email,
      phone: data.phone || null,
      role: data.role as any,
      isActive: true,
    },
  });

  // Create farmer profile if role is FARMER
  if (data.role === "FARMER") {
    await prisma.farmer.create({
      data: {
        tenantId,
        userId: user.id,
        fullName: data.name,
        cnicNumber: `DEV-${randomUUID().slice(0, 8).toUpperCase()}`,
        phone: data.phone || null,
      },
    });
  }

  return buildUserResponse(user.id);
}

/**
 * Dev-only: Login by email lookup only (no password check).
 */
export async function devLogin(email: string): Promise<UserResponse> {
  const user = await prisma.user.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!user) {
    throw new AppError("User not found. Please seed first.", 404);
  }

  return buildUserResponse(user.id);
}

/**
 * Dev-only: List all users with their auth source.
 */
export async function listDevUsers(): Promise<DevUserListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      farmer: { select: { fullName: true } },
      tenant: { select: { name: true, slug: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.farmer?.fullName || u.email.split("@")[0],
    role: u.role,
    tenantId: u.tenantId,
    tenantName: u.tenant?.name || null,
    isActive: u.isActive,
    createdAt: u.createdAt,
    authSource: u.authId?.startsWith("dev_") ? "dev-bypass" : "supabase",
  }));
}

/**
 * Build a standardized user response with a dev access token.
 */
async function buildUserResponse(userId: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farmer: true },
  });

  if (!user) throw new AppError("User not found", 404);

  const farmer = user.farmer;
  const authId = user.authId || "unknown";

  return {
    id: user.id,
    email: user.email,
    name: farmer?.fullName || user.email.split("@")[0],
    role: user.role,
    tenantId: user.tenantId,
    farmerId: farmer?.id || null,
    avatar: farmer?.profilePhotoUrl || null,
    accessToken: `dev_token_${authId}_${Date.now()}`,
    token: `dev_token_${authId}_${Date.now()}`,
    authSource: "dev-bypass",
  };
}
