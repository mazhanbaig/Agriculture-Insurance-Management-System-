import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export async function getSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      config: true,
      isActive: true,
      billingEnabled: true,
      createdAt: true,
    },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);
  return tenant;
}

export async function updateSettings(tenantId: string, data: {
  name?: string;
  logoUrl?: string | null;
  config?: Record<string, any>;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  if (!tenant.isActive) throw new AppError("Tenant is not active", 400);

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
  if (data.config !== undefined) {
    // Merge config with existing, don't overwrite entirely
    const existingConfig = (tenant.config as Record<string, any>) || {};
    updateData.config = { ...existingConfig, ...data.config };
  }

  return prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      config: true,
      isActive: true,
    },
  });
}
