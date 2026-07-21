import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue, fraudQueue } from "../lib/bullmq";
import {
  calculateBaseFraudScore,
  scoreToVerdict,
  FRAUD_CHECK_WEIGHTS,
} from "../utils/fraud-helpers";
import { haversineDistance } from "../utils/geo";
import { compareNDVI } from "../lib/sentinel";
import { checkWeatherForClaim } from "../lib/weather";
import { getFraudTierConfig, type FraudTier } from "../config/fraudTiers";
import { logUsage } from "./usage.service";
import * as openRouterLib from "../lib/openrouter";
import logger from "../utils/logger";

/**
 * Calculate the sync fraud score for a claim (runs during submission, < 100ms).
 * This performs free forensic checks without any AI or external API calls.
 */
export async function runSyncForensics(
  claimId: string,
  tenantId: string,
  claimantFarmerId: string,
  data: {
    policyId: string;
    incidentDate: string;
    claimedAmount: number;
    estimatedLossPercentage?: number;
  }
): Promise<{
  score: number;
  verdict: string;
  flags: string[];
  ruleResults: Record<string, any>;
}> {
  const flags: string[] = [];
  const checks: Array<{ weight: number; triggered: boolean }> = [];
  const ruleResults: Record<string, any> = {};

  // 1. Duplicate Claim Check (within 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const duplicateClaim = await prisma.claim.findFirst({
    where: {
      policyId: data.policyId,
      tenantId,
      submittedAt: { gte: thirtyDaysAgo },
      id: { not: claimId },
    },
  });
  if (duplicateClaim) {
    checks.push({ weight: FRAUD_CHECK_WEIGHTS.DUPLICATE_CLAIM, triggered: true });
    flags.push("DUPLICATE_CLAIM");
    ruleResults["DUPLICATE_CLAIM"] = { triggered: true, detail: `Previous claim ${duplicateClaim.claimNumber} found within 30 days` };
  } else {
    ruleResults["DUPLICATE_CLAIM"] = { triggered: false };
  }

  // 2. Claim Amount vs Loss Percentage check
  if (data.estimatedLossPercentage) {
    const policy = await prisma.policy.findUnique({
      where: { id: data.policyId },
      include: { policyPlan: true },
    });
    if (policy) {
      const expectedClaimAmount = policy.coverageAmount * (data.estimatedLossPercentage / 100);
      const ratio = data.claimedAmount / expectedClaimAmount;
      if (ratio > 1.5) {
        checks.push({ weight: FRAUD_CHECK_WEIGHTS.CLAIM_AMOUNT_MISMATCH, triggered: true });
        flags.push("CLAIM_AMOUNT_MISMATCH");
        ruleResults["CLAIM_AMOUNT_MISMATCH"] = { triggered: true, detail: `Claimed ${data.claimedAmount} vs expected ${expectedClaimAmount}` };
      } else {
        ruleResults["CLAIM_AMOUNT_MISMATCH"] = { triggered: false };
      }
    }
  }

  // 3. Farmer History check (>3 claims in last year)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentClaims = await prisma.claim.count({
    where: { farmerId: claimantFarmerId, tenantId, submittedAt: { gte: oneYearAgo } },
  });
  if (recentClaims > 3) {
    checks.push({ weight: FRAUD_CHECK_WEIGHTS.FARMER_HISTORY, triggered: true });
    flags.push("HIGH_FARMER_CLAIM_HISTORY");
    ruleResults["FARMER_HISTORY"] = { triggered: true, count: recentClaims };
  } else {
    ruleResults["FARMER_HISTORY"] = { triggered: false, count: recentClaims };
  }

  // Calculate base score from sync checks
  const score = calculateBaseFraudScore(checks);
  const verdict = scoreToVerdict(score);

  // Update claim with sync fraud score
  await prisma.claim.update({
    where: { id: claimId },
    data: { fraudScore: score, fraudVerdict: verdict },
  });

  // Write fraud audit log
  await prisma.fraudAuditLog.create({
    data: {
      claimId,
      score,
      verdict,
      flags,
      ruleResults,
      rawMetadata: {
        checkType: "sync",
        checksPerformed: checks.length,
        falseChecks: checks.filter((c) => !c.triggered).length,
        triggeredChecks: checks.filter((c) => c.triggered).length,
      },
    },
  });

  logger.info({ claimId, score, verdict, flags }, "Sync fraud analysis completed");

  return { score, verdict, flags, ruleResults };
}

/**
 * Enqueue an async fraud analysis job for a claim.
 * This runs AI checks in the background via BullMQ.
 */
export async function enqueueAsyncFraudAnalysis(
  claimId: string,
  tenantId: string
): Promise<void> {
  await fraudQueue.add(
    "fraud-analysis",
    { claimId, tenantId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}

/**
 * Perform async fraud analysis: AI image checks, satellite NDVI, weather verification.
 * This runs in a BullMQ worker.
 */
export async function runAsyncFraudAnalysis(
  claimId: string,
  tenantId: string
): Promise<void> {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId },
    include: {
      documents: true,
      policy: { include: { landParcel: true, policyPlan: true } },
      farmer: true,
      fraudAuditLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!claim) throw new AppError("Claim not found", 404);

  const currentScore = claim.fraudScore || 0;
  const flags: string[] = [];
  const ruleResults: Record<string, any> = {};
  let additionalScore = 0;

  // Resolve fraud tier from tenant config (default: forge)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  const tenantConfig = (tenant?.config as Record<string, any>) || {};
  const fraudTierName: string = tenantConfig.fraudTier || "forge";
  const tierConfig = getFraudTierConfig(fraudTierName);

  // 4. Check claim documents for AI-based analysis
  const documents = claim.documents.filter((d: any) => d.type === "photo" || d.type === "video");

  if (documents.length > 0) {
    const photoDocs = documents.filter((d: any) => d.type === "photo");
    const imagesToAnalyze = photoDocs.slice(0, tierConfig.maxImagesPerClaim);

    for (const doc of imagesToAnalyze) {
      try {
        const { result, modelUsed, fallbackUsed } = await openRouterLib.analyzeWithFallback(
          doc.url,
          "Analyze this image for crop damage. Is this a farm with visible crop damage? Reply with YES or NO and a brief reason.",
          tierConfig.primaryModel,
          tierConfig.fallbackModel
        );

        // Log usage for billing
        await logUsage({
          tenantId,
          service: "openrouter",
          tier: fraudTierName,
          model: modelUsed,
          quantity: 1,
          metadata: { claimId, documentId: doc.id, fallbackUsed },
        });

        if (result.toUpperCase().startsWith("NO")) {
          additionalScore += FRAUD_CHECK_WEIGHTS.AI_IMAGE_CHECK;
          flags.push("AI_IMAGE_DAMAGE_NOT_CONFIRMED");
          ruleResults["AI_IMAGE_CHECK"] = { triggered: true, result, modelUsed, fallbackUsed };
        } else {
          ruleResults["AI_IMAGE_CHECK"] = { triggered: false, result, modelUsed };
        }
      } catch (error) {
        logger.error({ error, documentId: doc.id }, "OpenRouter AI analysis failed");
        ruleResults["AI_IMAGE_CHECK"] = { triggered: false, error: String(error) };
      }
    }
  }

  // 5. CNIC cross-check — extract CNIC from uploaded documents and verify against farmer record
  if (claim.farmer?.cnicNumber) {
    const cnicDocs = claim.documents.filter((d: any) => d.type === "photo");
    const cnicImage = cnicDocs[0]; // Pick first photo document for OCR

    if (cnicImage) {
      try {
        const cnicPrompt = "Extract all CNIC/NIC/ID card numbers from this document. A Pakistani CNIC is 13 digits in format XXXXX-XXXXXXX-X or 13 consecutive digits. Reply with ONLY the number (digits only, no dashes) if found, or 'NO_CNIC' if no ID number is visible.";

        const { result: ocrResult, modelUsed } = await openRouterLib.analyzeWithFallback(
          cnicImage.url,
          cnicPrompt,
          tierConfig.primaryModel,
          tierConfig.fallbackModel
        );

        // Log OCR usage
        await logUsage({
          tenantId,
          service: "openrouter",
          tier: fraudTierName,
          model: modelUsed,
          quantity: 1,
          metadata: { claimId, documentId: cnicImage.id, check: "cnic_crosscheck" },
        });

        // Extract 13-digit CNIC from OCR result using regex for robustness
        // Handles both raw 13-digit runs and formatted XXXXX-XXXXXXX-X patterns
        const cnicPattern = ocrResult.match(/\b\d{5}-?\d{7}-?\d{1}\b/);
        const extractedCnic = cnicPattern ? cnicPattern[0].replace(/\D/g, "") : null;

        if (extractedCnic) {
          const farmerCnic = claim.farmer.cnicNumber.replace(/\D/g, "");
          const cnicMatch = extractedCnic === farmerCnic;

          ruleResults["CNIC_MISMATCH"] = {
            triggered: !cnicMatch,
            extractedCnic,
            farmerCnic,
            match: cnicMatch,
            rawOcr: ocrResult.slice(0, 100),
          };

          if (!cnicMatch) {
            additionalScore += FRAUD_CHECK_WEIGHTS.CNIC_MISMATCH;
            flags.push("CNIC_MISMATCH");
          }
        } else {
          ruleResults["CNIC_MISMATCH"] = {
            triggered: false,
            error: "No CNIC pattern found in document OCR",
            rawOcr: ocrResult.slice(0, 100),
          };
        }
      } catch (error) {
        logger.error({ error, documentId: cnicImage.id }, "CNIC extraction failed");
        ruleResults["CNIC_MISMATCH"] = { triggered: false, error: String(error) };
      }
    }
  }

  // 6. Satellite NDVI check
  const landParcel = claim.policy?.landParcel;
  if (landParcel?.latitude && landParcel?.longitude && tierConfig.satelliteEnabled) {
    try {
      const ndviResult = await compareNDVI(
        landParcel.latitude,
        landParcel.longitude,
        claim.incidentDate
      );

      // Log satellite usage
      await logUsage({
        tenantId,
        service: "sentinel",
        tier: fraudTierName,
        quantity: 1,
        metadata: { claimId, landParcelId: landParcel.id, thresholdBreached: ndviResult.thresholdBreached },
      });

      ruleResults["SATELLITE_NDVI"] = ndviResult;
      if (!ndviResult.thresholdBreached) {
        additionalScore += FRAUD_CHECK_WEIGHTS.SATELLITE_NDVI;
        flags.push("NDVI_NO_SIGNIFICANT_DROP");
      }
    } catch (error) {
      logger.error({ error }, "NDVI check failed");
      ruleResults["SATELLITE_NDVI"] = { error: String(error) };
    }
  }

  // 6. Weather verification (via OpenWeather — checks HISTORICAL weather at incident date)
  if (tierConfig.weatherEnabled) {
    try {
      const landParcel = claim.policy?.landParcel;
      const weatherResult = await checkWeatherForClaim(
        landParcel?.latitude,
        landParcel?.longitude,
        claim.incidentDate
      );

      // Log weather usage
      await logUsage({
        tenantId,
        service: "openweather",
        tier: fraudTierName,
        quantity: 1,
        metadata: {
          claimId,
          location: claim.incidentLocation,
          method: weatherResult.method,
          confirmed: weatherResult.confirmed,
          event: weatherResult.event,
        },
      });

      ruleResults["WEATHER_TRUTH"] = {
        triggered: weatherResult.confirmed ? false : weatherResult.method !== "none",
        method: weatherResult.method,
        event: weatherResult.event,
        detail: weatherResult.confirmed
          ? `Severe weather confirmed: ${weatherResult.event}`
          : weatherResult.method !== "none"
            ? "No severe weather event detected at incident location"
            : "Weather data unavailable — check skipped",
      };

      if (!weatherResult.confirmed && weatherResult.method !== "none") {
        additionalScore += FRAUD_CHECK_WEIGHTS.WEATHER_TRUTH;
        flags.push("WEATHER_NO_SEVERE_EVENT");
      }
    } catch (error) {
      logger.error({ error }, "Weather check failed");
      ruleResults["WEATHER_TRUTH"] = { triggered: false, error: String(error) };
    }
  }

  // Calculate final score
  const finalScore = Math.min(currentScore + additionalScore, 100);
  const finalVerdict = scoreToVerdict(finalScore);

  // Update claim
  await prisma.claim.update({
    where: { id: claimId },
    data: { fraudScore: finalScore, fraudVerdict: finalVerdict },
  });

  // Write fraud audit log for async analysis
  await prisma.fraudAuditLog.create({
    data: {
      claimId,
      score: additionalScore,
      verdict: finalVerdict,
      flags: flags.length > 0 ? flags : ["NONE"],
      ruleResults,
      rawMetadata: {
        checkType: "async",
        checksPerformed: ["AI_IMAGE", "CNIC", "SATELLITE_NDVI", "WEATHER"].length,
        additionalScore,
        finalScore,
      },
    },
  });

  // Notify if fraud score changed significantly
  if (finalVerdict !== scoreToVerdict(currentScore)) {
    await notificationQueue.add("fraud-score-updated", {
      userId: claim.farmerId,
      type: "FRAUD_SCORE_UPDATED",
      title: "Fraud Analysis Complete",
      message: `Claim ${claim.claimNumber} fraud assessment updated to ${finalVerdict} (score: ${finalScore})`,
      relatedEntityType: "Claim",
      relatedEntityId: claim.id,
    });
  }

  logger.info(
    { claimId, previousScore: currentScore, finalScore, finalVerdict, flags },
    "Async fraud analysis completed"
  );
}
