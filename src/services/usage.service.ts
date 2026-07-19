import { prisma } from "../lib/prisma";
import { FRAUD_TIERS, type FraudTierConfig } from "../config/fraudTiers";

/**
 * Log an external API call for usage-based billing.
 * Calculates cost based on the tenant's fraud tier configuration.
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

  const cost = costPerUnit * quantity;
  const markup = cost * (tierConfig.markupMultiplier - 1);
  const totalCost = cost + markup;

  await prisma.usageLog.create({
    data: {
      tenantId: params.tenantId,
      service: params.service,
      tier: params.tier,
      model: params.model || null,
      quantity,
      cost,
      markup,
      totalCost,
      metadata: params.metadata || {},
    },
  });
}

/**
 * Get usage summary for a tenant within a date range.
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
    totalCost: logs.reduce((sum, l) => sum + l.totalCost, 0),
    byService: {} as Record<string, { calls: number; cost: number }>,
    byDate: {} as Record<string, { calls: number; cost: number }>,
  };

  for (const log of logs) {
    // Aggregate by service
    if (!summary.byService[log.service]) {
      summary.byService[log.service] = { calls: 0, cost: 0 };
    }
    summary.byService[log.service].calls += 1;
    summary.byService[log.service].cost += log.totalCost;

    // Aggregate by date
    const dateKey = log.createdAt.toISOString().split("T")[0];
    if (!summary.byDate[dateKey]) {
      summary.byDate[dateKey] = { calls: 0, cost: 0 };
    }
    summary.byDate[dateKey].calls += 1;
    summary.byDate[dateKey].cost += log.totalCost;
  }

  return summary;
}
