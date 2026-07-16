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

export async function listTenants(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.count(),
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
    data: { isActive: false },
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
  if (!tenant.isActive) throw new AppError("Cannot seed plans for an inactive tenant", 400);

  const created = await Promise.all(
    plans.map((plan) =>
      prisma.policyPlan.create({
        data: { tenantId, ...plan },
      })
    )
  );

  return created;
}
