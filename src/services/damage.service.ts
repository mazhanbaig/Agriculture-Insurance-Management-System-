import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";

export interface DamageInput {
  claimId: string;
  tenantId: string;
  ndviDamagePercent?: number;
  weatherConfirmed?: boolean;
  aiDamageScore?: number;
  groundTruthDamagePercent?: number;
}

export interface PayoutResult {
  finalDamagePercent: number;
  calculatedPayout: number;
  breakdown: {
    ndviWeight: number;
    weatherWeight: number;
    aiWeight: number;
    groundTruthWeight: number;
    ndviContribution: number;
    weatherContribution: number;
    aiContribution: number;
    groundTruthContribution: number;
  };
  coverageAmount: number;
  policyId: string;
}

export async function calculateDamageAndPayout(input: DamageInput): Promise<PayoutResult> {
  const claim = await prisma.claim.findUnique({
    where: { id: input.claimId },
    include: { policy: { include: { policyPlan: true } } },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  if (!claim.policy) throw new AppError("Claim has no associated policy", 400);

  const coverageAmount = claim.policy.coverageAmount;
  const basePremiumRate = claim.policy.policyPlan?.premiumRate || 1;

  const config = {
    ndviWeight: 0.35,
    weatherWeight: 0.15,
    aiWeight: 0.20,
    groundTruthWeight: 0.30,
    maxPayoutPercent: 0.95,
    minPayoutPercent: 0.02,
  };

  const ndviContribution = (input.ndviDamagePercent || 0) * config.ndviWeight;
  const weatherContribution = input.weatherConfirmed
    ? 100 * config.weatherWeight
    : 0;
  const aiContribution = (input.aiDamageScore || 0) * config.aiWeight;
  const groundTruthContribution = (input.groundTruthDamagePercent || 0) * config.groundTruthWeight;

  const baseDenominator =
    (input.ndviDamagePercent ? config.ndviWeight : 0) +
    (input.weatherConfirmed !== undefined ? config.weatherWeight : 0) +
    (input.aiDamageScore ? config.aiWeight : 0) +
    (input.groundTruthDamagePercent ? config.groundTruthWeight : 0);

  const finalDamagePercent = baseDenominator > 0
    ? Math.min(
        (ndviContribution + weatherContribution + aiContribution + groundTruthContribution) / baseDenominator,
        100
      )
    : Math.max(
        input.ndviDamagePercent || input.aiDamageScore || input.groundTruthDamagePercent || 0,
        0
      );

  const cappedDamagePercent = Math.min(finalDamagePercent, config.maxPayoutPercent * 100);
  const payoutRatio = cappedDamagePercent / 100;
  const calculatedPayout = Math.round(coverageAmount * payoutRatio * 100) / 100;

  const minPayout = coverageAmount * config.minPayoutPercent;
  const finalPayout = Math.max(calculatedPayout, minPayout);

  const result: PayoutResult = {
    finalDamagePercent: cappedDamagePercent,
    calculatedPayout: finalPayout,
    coverageAmount,
    policyId: claim.policy.id,
    breakdown: {
      ndviWeight: config.ndviWeight,
      weatherWeight: config.weatherWeight,
      aiWeight: config.aiWeight,
      groundTruthWeight: config.groundTruthWeight,
      ndviContribution: input.ndviDamagePercent || 0,
      weatherContribution: input.weatherConfirmed ? 100 : 0,
      aiContribution: input.aiDamageScore || 0,
      groundTruthContribution: input.groundTruthDamagePercent || 0,
    },
  };

  const existing = await prisma.damageAssessment.findFirst({
    where: { claimId: input.claimId, tenantId: input.tenantId },
  });

  if (existing) {
    await prisma.damageAssessment.update({
      where: { id: existing.id },
      data: {
        ndviDamagePercent: input.ndviDamagePercent,
        weatherConfirmed: input.weatherConfirmed,
        aiDamageScore: input.aiDamageScore,
        groundTruthDamagePercent: input.groundTruthDamagePercent,
        finalDamagePercent: result.finalDamagePercent,
        calculatedPayout: result.calculatedPayout,
        calculationLog: JSON.parse(JSON.stringify(result)),
      },
    });
  } else {
    await prisma.damageAssessment.create({
      data: {
        claimId: input.claimId,
        tenantId: input.tenantId,
        ndviDamagePercent: input.ndviDamagePercent,
        weatherConfirmed: input.weatherConfirmed,
        aiDamageScore: input.aiDamageScore,
        groundTruthDamagePercent: input.groundTruthDamagePercent,
        finalDamagePercent: result.finalDamagePercent,
        calculatedPayout: result.calculatedPayout,
        calculationLog: JSON.parse(JSON.stringify(result)),
      },
    });
  }

  logger.info({ claimId: input.claimId, finalDamagePercent: result.finalDamagePercent, calculatedPayout: result.calculatedPayout }, "Damage calculation completed");
  return result;
}

export async function getDamageAssessment(claimId: string, tenantId: string) {
  const assessment = await prisma.damageAssessment.findFirst({
    where: { claimId, tenantId },
  });
  return assessment;
}
