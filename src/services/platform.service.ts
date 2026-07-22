import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";
import { createStripeCustomer, isBillingEnabled } from "./billing.service";
import pino from "pino";

const logger = pino({ name: "platform" });

export async function createTenant(data: {
  name: string;
  slug: string;
  adminEmail: string;
  logoUrl?: string;
  billingEnabled?: boolean;
}) {
  const existingSlug = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (existingSlug) throw new AppError("A tenant with this slug already exists", 409);

  const existingName = await prisma.tenant.findUnique({ where: { name: data.name } });
  if (existingName) throw new AppError("A tenant with this name already exists", 409);

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      logoUrl: data.logoUrl,
      status: "ACTIVE",
      billingEnabled: data.billingEnabled ?? false,
    },
  });

  // Create the TENANT_ADMIN user
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      authId: `tenant-admin-${tenant.id}`,
      email: data.adminEmail,
      role: "TENANT_ADMIN",
    },
  });

  // Queue a welcome notification
  await notificationQueue.add("tenant-created", {
    userId: user.id,
    type: "TENANT_CREATED",
    title: "Tenant Created",
    message: `Tenant "${tenant.name}" has been created. Welcome!`,
    relatedEntityType: "Tenant",
    relatedEntityId: tenant.id,
  });

  // If billing is enabled globally, create Stripe customer for this tenant
  if (isBillingEnabled()) {
    try {
      await createStripeCustomer(tenant.id);
      logger.info({ tenantId: tenant.id }, "Stripe customer created during tenant onboarding");
    } catch (stripeError) {
      // Don't block tenant creation if Stripe fails
      logger.error({ error: stripeError, tenantId: tenant.id }, "Failed to create Stripe customer during onboarding");
    }
  }

  return { tenant, adminUser: user };
}

/**
 * Public signup — creates tenant in PENDING_APPROVAL status.
 * No auth required. Tenant cannot be used until PLATFORM_ADMIN approves.
 */
export async function signupTenant(data: {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword?: string;
  logoUrl?: string;
}) {
  const existingSlug = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (existingSlug) throw new AppError("A tenant with this slug already exists", 409);

  const existingName = await prisma.tenant.findUnique({ where: { name: data.name } });
  if (existingName) throw new AppError("A tenant with this name already exists", 409);

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      logoUrl: data.logoUrl,
      status: "PENDING_APPROVAL",
      billingEnabled: false,
    },
  });

  // Create the first TENANT_ADMIN user (placeholder authId — they'll need Supabase sign-up)
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      authId: `pending-tenant-admin-${tenant.id}-${Date.now()}`,
      email: data.adminEmail,
      role: "TENANT_ADMIN",
    },
  });

  // Notify platform admins about new signup
  const platformAdmins = await prisma.user.findMany({
    where: { role: "PLATFORM_ADMIN", isActive: true },
    select: { id: true },
  });

  for (const admin of platformAdmins) {
    await notificationQueue.add("tenant-signup", {
      userId: admin.id,
      type: "TENANT_SIGNUP",
      title: "New Tenant Signup",
      message: `Tenant "${tenant.name}" (${data.adminEmail}) has signed up and is awaiting approval.`,
      relatedEntityType: "Tenant",
      relatedEntityId: tenant.id,
    });
  }

  logger.info({ tenantId: tenant.id, email: data.adminEmail }, "New tenant signup — pending approval");

  return { tenant, adminUser: user };
}

/**
 * Approve a pending tenant — sets status to ACTIVE.
 */
export async function approveTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  if (tenant.status !== "PENDING_APPROVAL") {
    throw new AppError("Tenant is not in pending approval status", 400);
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: "ACTIVE" },
  });

  // Notify the TENANT_ADMIN(s) that they've been approved
  const tenantAdmins = await prisma.user.findMany({
    where: { tenantId, role: "TENANT_ADMIN", isActive: true },
    select: { id: true },
  });

  for (const admin of tenantAdmins) {
    await notificationQueue.add("tenant-approved", {
      userId: admin.id,
      type: "TENANT_APPROVED",
      title: "Tenant Approved",
      message: `Your tenant "${tenant.name}" has been approved. You can now log in and use the platform.`,
      relatedEntityType: "Tenant",
      relatedEntityId: tenant.id,
    });
  }

  logger.info({ tenantId }, "Tenant approved");
  return updated;
}

/**
 * Suspend a tenant — sets status to SUSPENDED.
 */
export async function suspendTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  if (tenant.status === "SUSPENDED") {
    throw new AppError("Tenant is already suspended", 400);
  }

  return prisma.tenant.update({
    where: { id: tenantId },
    data: { status: "SUSPENDED" },
  });
}

export async function listTenants(page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = {};
  if (status) where.status = status;
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.count({ where }),
  ]);
  return {
    tenants,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { users: true, farmers: true, policyPlans: true } } },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);
  return tenant;
}

export async function updateTenant(tenantId: string, data: Record<string, any>) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);

  if (data.slug && data.slug !== tenant.slug) {
    const slugExists = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (slugExists) throw new AppError("A tenant with this slug already exists", 409);
  }
  if (data.name && data.name !== tenant.name) {
    const nameExists = await prisma.tenant.findUnique({ where: { name: data.name } });
    if (nameExists) throw new AppError("A tenant with this name already exists", 409);
  }

  return prisma.tenant.update({ where: { id: tenantId }, data });
}

export async function deactivateTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { status: "SUSPENDED" },
  });
}

export async function seedTenantPlans(
  tenantId: string,
  plans: Array<{
    name: string;
    cropType: string;
    coveragePerAcre: number;
    premiumRate: number;
    minAreaAcres?: number;
    maxAreaAcres?: number;
    termMonths: number;
    description?: string;
  }>
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  if (tenant.status !== "ACTIVE") throw new AppError("Cannot seed plans for an inactive tenant", 400);

  const created = await Promise.all(
    plans.map((plan) =>
      prisma.policyPlan.create({
        data: { tenantId, ...plan },
      })
    )
  );

  return created;
}
