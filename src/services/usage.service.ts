import { prisma } from "../lib/prisma";
import { FRAUD_TIERS, type FraudTierConfig } from "../config/fraudTiers";

/**
 * Log an external API call for usage-based billing.
 * Computes both rawCost (actual provider cost) and billedCost (rawCost × 1.10).
 * The flat 10% markup replaces the old tier-specific markupMultiplier model.
 */
export async function logUsage(params: {
  tenantId: string;
  service: "openrouter" | "sentinel" | "openweather";
  tier: string;
  model?: string;
  quantity?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  const tierConfig = FRAUD_TIERS[params.tier as keyof typeof FRAUD_TIERS];
  if (!tierConfig) return; // Skip logging if tier not found

  const quantity = params.quantity || 1;

  // Determine per-unit cost based on service
  let costPerUnit = 0;
  switch (params.service) {
    case "openrouter":
      costPerUnit = tierConfig.imageCostPerCall;
      break;
    case "sentinel":
      costPerUnit = tierConfig.satelliteCostPerCall;
      if (!tierConfig.satelliteEnabled) return; // Don't log if satellite is disabled
      break;
    case "openweather":
      costPerUnit = tierConfig.weatherCostPerCall;
      if (!tierConfig.weatherEnabled) return; // Don't log if weather is disabled
      break;
  }

  const rawCost = costPerUnit * quantity;
  const billedCost = Math.round(rawCost * 1.10 * 100) / 100; // Flat 10% markup, rounded to cents
  const markup = billedCost - rawCost;

  await prisma.usageLog.create({
    data: {
      tenantId: params.tenantId,
      service: params.service,
      tier: params.tier,
      model: params.model || null,
      quantity,
      cost: rawCost,
      markup,
      totalCost: billedCost,
      rawCost,
      billedCost,
      metadata: params.metadata || {},
    },
  });
}

/**
 * Get usage summary for a tenant within a date range.
 * Returns both rawCost (provider cost) and billedCost (rawCost × 1.10)
 * for full transparency.
 */
export async function getUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  const logs = await prisma.usageLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
    orderBy: { createdAt: "desc" },
  });

  const summary = {
    totalCalls: logs.length,
    totalRawCost: logs.reduce((sum: number, l: any) => sum + (l.rawCost ?? l.cost), 0),
    totalBilledCost: logs.reduce((sum: number, l: any) => sum + (l.billedCost ?? l.totalCost), 0),
    markupAmount: logs.reduce((sum: number, l: any) => sum + ((l.billedCost ?? l.totalCost) - (l.rawCost ?? l.cost)), 0),
    markupPercent: 10, // Flat 10% markup
    byService: {} as Record<string, { calls: number; rawCost: number; billedCost: number }>,
    byDate: {} as Record<string, { calls: number; rawCost: number; billedCost: number }>,
  };

  for (const log of logs) {
    const rawCost = log.rawCost ?? log.cost;
    const billedCost = log.billedCost ?? log.totalCost;

    // Aggregate by service
    if (!summary.byService[log.service]) {
      summary.byService[log.service] = { calls: 0, rawCost: 0, billedCost: 0 };
    }
    summary.byService[log.service].calls += 1;
    summary.byService[log.service].rawCost += rawCost;
    summary.byService[log.service].billedCost += billedCost;

    // Aggregate by date
    const dateKey = log.createdAt.toISOString().split("T")[0];
    if (!summary.byDate[dateKey]) {
      summary.byDate[dateKey] = { calls: 0, rawCost: 0, billedCost: 0 };
    }
    summary.byDate[dateKey].calls += 1;
    summary.byDate[dateKey].rawCost += rawCost;
    summary.byDate[dateKey].billedCost += billedCost;
  }

  return summary;
}
