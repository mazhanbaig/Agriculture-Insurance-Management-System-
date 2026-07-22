import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

import { FRAUD_TIERS, getFraudTierConfig, type FraudTier } from "../config/fraudTiers";
import { listAvailableGateways, updatePaymentGateway } from "../lib/paymentGatewayFactory";
import type { GatewayType } from "../config/paymentGateways";

export async function getSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      config: true,
      status: true,
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
  if (tenant.status !== "ACTIVE") throw new AppError("Tenant is not active", 400);

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
      status: true,
    },
  });
}

/**
 * Get the tenant's fraud tier configuration.
 * Returns the tier name, label, and full config details.
 */
export async function getFraudTierSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);

  const config = (tenant.config as Record<string, any>) || {};
  const tierName: string = config.fraudTier || "forge";
  const tierConfig = getFraudTierConfig(tierName);

  return {
    currentTier: tierName,
    label: tierConfig.label,
    config: tierConfig,
    availableTiers: Object.values(FRAUD_TIERS).map((t) => ({
      name: t.name,
      label: t.label,
      description: t.description,
      baseMonthlyFee: t.baseMonthlyFee,
      imageCostPerCall: t.imageCostPerCall,
    })),
  };
}

/**
 * Update the tenant's fraud tier.
 * Validates that the tier name is one of: forge, titan, goat.
 */
export async function updateFraudTier(tenantId: string, tierName: string | undefined) {
  if (!tierName) throw new AppError("Fraud tier is required", 400);

  const normalizedTier = tierName.toLowerCase();
  if (!["forge", "titan", "goat"].includes(normalizedTier)) {
    throw new AppError("Invalid fraud tier. Choose: forge, titan, or goat", 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);

  const existingConfig = (tenant.config as Record<string, any>) || {};
  const tierConfig = getFraudTierConfig(normalizedTier);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      config: {
        ...existingConfig,
        fraudTier: normalizedTier,
      },
    },
  });

  return {
    currentTier: normalizedTier,
    label: tierConfig.label,
    config: tierConfig,
  };
}

// ─── Payment Gateway Settings ─────────────────────────────────────

export async function getPaymentGatewaySettings(tenantId: string) {
  return listAvailableGateways(tenantId);
}

export async function updatePaymentGatewaySettings(
  tenantId: string,
  data: { gateway: GatewayType; currency?: string }
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);

  await updatePaymentGateway(tenantId, data.gateway, data.currency);
  return listAvailableGateways(tenantId);
}
