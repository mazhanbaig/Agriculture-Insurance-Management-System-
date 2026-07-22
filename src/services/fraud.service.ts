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
 * Perform async fraud analysis using a strict 3-tier sequential pipeline:
 *
 * Tier 1 — Forensic/Satellite (Sentinel Hub): NDVI pre/post comparison.
 *           Not an LLM call. Runs first, cheapest, fastest.
 *
 * Tier 2 — Weather (OpenWeather): Historical weather verification at the
 *           incident date/location. Runs second, confirms or contradicts
 *           Tier 1's satellite signal.
 *
 * Tier 3 — LLM confirmation (OpenRouter): Final image/document analysis
 *           with Tier 1 and Tier 2 results injected into the prompt as
 *           grounding context so the LLM isn't guessing blind.
 *
 * This replaces the old concurrent approach. Each tier awaits the previous,
 * and results are stored separately in FraudAuditLog for auditability.
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

  const landParcel = claim.policy?.landParcel;

  // ────────────────────────────────────────────────────────────────
  // TIER 1 — Satellite NDVI (Sentinel Hub)
  // ────────────────────────────────────────────────────────────────
  let sentinelResult: Record<string, any> = { skipped: true, reason: "Satellite check not configured or location unavailable" };

  if (landParcel?.latitude && landParcel?.longitude && tierConfig.satelliteEnabled) {
    try {
      const ndviData = await compareNDVI(
        landParcel.latitude,
        landParcel.longitude,
        claim.incidentDate
      );

      // Log satellite usage for billing
      await logUsage({
        tenantId,
        service: "sentinel",
        tier: fraudTierName,
        quantity: 1,
        metadata: { claimId, landParcelId: landParcel.id, thresholdBreached: ndviData.thresholdBreached },
      });

      sentinelResult = {
        tier: 1,
        name: "Satellite NDVI",
        ndviPre: ndviData.ndviPre,
        ndviPost: ndviData.ndviPost,
        ndviDrop: ndviData.ndviDrop,
        thresholdBreached: ndviData.thresholdBreached,
      };

      ruleResults["SATELLITE_NDVI"] = ndviData;
      if (!ndviData.thresholdBreached) {
        additionalScore += FRAUD_CHECK_WEIGHTS.SATELLITE_NDVI;
        flags.push("NDVI_NO_SIGNIFICANT_DROP");
      }

      logger.info({ claimId, ndviDrop: ndviData.ndviDrop, thresholdBreached: ndviData.thresholdBreached }, "Tier 1: Satellite NDVI check complete");
    } catch (error) {
      logger.error({ error }, "Tier 1: Satellite NDVI check failed");
      sentinelResult = { tier: 1, name: "Satellite NDVI", error: String(error) };
      ruleResults["SATELLITE_NDVI"] = { error: String(error) };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // TIER 2 — Weather Verification (OpenWeather)
  // Uses Sentinel's incident window if NDVI detected a drop window,
  // otherwise uses the claim's incident date.
  // ────────────────────────────────────────────────────────────────
  let weatherResult: Record<string, any> = { skipped: true, reason: "Weather check not configured" };

  if (tierConfig.weatherEnabled) {
    try {
      const weatherData = await checkWeatherForClaim(
        landParcel?.latitude,
        landParcel?.longitude,
        claim.incidentDate
      );

      // Log weather usage for billing
      await logUsage({
        tenantId,
        service: "openweather",
        tier: fraudTierName,
        quantity: 1,
        metadata: {
          claimId,
          location: claim.incidentLocation,
          method: weatherData.method,
          confirmed: weatherData.confirmed,
          event: weatherData.event,
        },
      });

      weatherResult = {
        tier: 2,
        name: "Weather Verification",
        method: weatherData.method,
        confirmed: weatherData.confirmed,
        event: weatherData.event || null,
        detail: weatherData.confirmed
          ? `Severe weather confirmed: ${weatherData.event}`
          : weatherData.method !== "none"
            ? "No severe weather event detected at incident location"
            : "Weather data unavailable — check skipped",
      };

      ruleResults["WEATHER_TRUTH"] = weatherResult;
      if (!weatherData.confirmed && weatherData.method !== "none") {
        additionalScore += FRAUD_CHECK_WEIGHTS.WEATHER_TRUTH;
        flags.push("WEATHER_NO_SEVERE_EVENT");
      }

      logger.info({ claimId, confirmed: weatherData.confirmed, event: weatherData.event }, "Tier 2: Weather verification complete");
    } catch (error) {
      logger.error({ error }, "Tier 2: Weather verification failed");
      weatherResult = { tier: 2, name: "Weather Verification", error: String(error) };
      ruleResults["WEATHER_TRUTH"] = { triggered: false, error: String(error) };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // TIER 3 — LLM Confirmation (OpenRouter)
  // Runs last, with Tier 1 and Tier 2 results injected into the prompt
  // as grounding context so the LLM doesn't guess independently.
  // ────────────────────────────────────────────────────────────────
  let llmResult: Record<string, any> = { skipped: true, reason: "No documents to analyze" };

  const documents = claim.documents.filter((d: any) => d.type === "photo" || d.type === "video");

  if (documents.length > 0) {
    llmResult = { tier: 3, name: "LLM Confirmation", checks: [] };

    // Build grounded prompt context from Tier 1 and Tier 2 results
    const contextParts: string[] = [];
    if (!sentinelResult.skipped && !sentinelResult.error) {
      contextParts.push(
        `Satellite NDVI analysis: NDVI drop of ${sentinelResult.ndviDrop ?? "unknown"} ` +
        `(threshold breached: ${sentinelResult.thresholdBreached ?? "unknown"}). ` +
        `${sentinelResult.thresholdBreached ? "Significant vegetation loss detected, consistent with crop damage." : "No significant NDVI drop detected."}`
      );
    } else if (sentinelResult.error) {
      contextParts.push(`Satellite NDVI analysis unavailable: ${sentinelResult.error}`);
    }

    if (!weatherResult.skipped && !weatherResult.error) {
      contextParts.push(
        `Weather verification at incident date/location: ` +
        `${weatherResult.confirmed ? `Severe weather confirmed: ${weatherResult.event}` : "No severe weather event detected"}. ` +
        `(Method: ${weatherResult.method})`
      );
    } else if (weatherResult.error) {
      contextParts.push(`Weather verification unavailable: ${weatherResult.error}`);
    }
    const groundContext = contextParts.length > 0
      ? `\n\nGround context from prior analysis:\n${contextParts.join("\n")}`
      : "";

    // 3a. Image damage analysis with grounded context
    const photoDocs = documents.filter((d: any) => d.type === "photo");
    const imagesToAnalyze = photoDocs.slice(0, tierConfig.maxImagesPerClaim);

    for (const doc of imagesToAnalyze) {
      try {
        const promptText =
          "Analyze this image for crop damage. Is this a farm with visible crop damage? " +
          "Reply with YES or NO and a brief reason." + groundContext;

        const { result, modelUsed, fallbackUsed } = await openRouterLib.analyzeWithFallback(
          doc.url,
          promptText,
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
          metadata: { claimId, documentId: doc.id, fallbackUsed, tier: 3, check: "image_damage" },
        });

        const checkResult: Record<string, any> = { type: "image_damage", result, modelUsed, fallbackUsed };
        llmResult.checks.push(checkResult);

        if (result.toUpperCase().startsWith("NO")) {
          additionalScore += FRAUD_CHECK_WEIGHTS.AI_IMAGE_CHECK;
          flags.push("AI_IMAGE_DAMAGE_NOT_CONFIRMED");
          ruleResults["AI_IMAGE_CHECK"] = { triggered: true, result, modelUsed, fallbackUsed };
        } else {
          ruleResults["AI_IMAGE_CHECK"] = { triggered: false, result, modelUsed };
        }
      } catch (error) {
        logger.error({ error, documentId: doc.id }, "Tier 3: Image analysis failed");
        llmResult.checks.push({ type: "image_damage", documentId: doc.id, error: String(error) });
        ruleResults["AI_IMAGE_CHECK"] = { triggered: false, error: String(error) };
      }
    }

    // 3b. CNIC cross-check (still part of Tier 3 — uses the same LLM)
    if (claim.farmer?.cnicNumber) {
      const cnicDocs = claim.documents.filter((d: any) => d.type === "photo");
      const cnicImage = cnicDocs[0];

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
            metadata: { claimId, documentId: cnicImage.id, check: "cnic_crosscheck", tier: 3 },
          });

          const cnicPattern = ocrResult.match(/\b\d{5}-?\d{7}-?\d{1}\b/);
          const extractedCnic = cnicPattern ? cnicPattern[0].replace(/\D/g, "") : null;

          let cnicCheck: Record<string, any> = { type: "cnic_crosscheck" };

          if (extractedCnic) {
            const farmerCnic = claim.farmer.cnicNumber.replace(/\D/g, "");
            const cnicMatch = extractedCnic === farmerCnic;

            cnicCheck = { ...cnicCheck, extractedCnic, farmerCnic, match: cnicMatch, rawOcr: ocrResult.slice(0, 100) };
            llmResult.checks.push(cnicCheck);

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
            cnicCheck = { ...cnicCheck, error: "No CNIC pattern found in document OCR", rawOcr: ocrResult.slice(0, 100) };
            llmResult.checks.push(cnicCheck);
            ruleResults["CNIC_MISMATCH"] = { triggered: false, error: "No CNIC pattern found in document OCR" };
          }
        } catch (error) {
          logger.error({ error, documentId: cnicImage.id }, "Tier 3: CNIC extraction failed");
          llmResult.checks.push({ type: "cnic_crosscheck", error: String(error) });
          ruleResults["CNIC_MISMATCH"] = { triggered: false, error: String(error) };
        }
      }
    }

    logger.info({ claimId, checksPerformed: llmResult.checks.length }, "Tier 3: LLM confirmation complete");
  }

  // ────────────────────────────────────────────────────────────────
  // Calculate final score & update claim
  // ────────────────────────────────────────────────────────────────
  const finalScore = Math.min(currentScore + additionalScore, 100);
  const finalVerdict = scoreToVerdict(finalScore);

  await prisma.claim.update({
    where: { id: claimId },
    data: { fraudScore: finalScore, fraudVerdict: finalVerdict },
  });

  // Write fraud audit log with tier-separated results
  await prisma.fraudAuditLog.create({
    data: {
      claimId,
      score: additionalScore,
      verdict: finalVerdict,
      flags: flags.length > 0 ? flags : ["NONE"],
      ruleResults,
      sentinelResult,
      weatherResult,
      llmResult,
      rawMetadata: {
        pipeline: "sequential-3-tier",
        tierOrder: ["Sentinel NDVI", "OpenWeather", "LLM Confirmation"],
        additionalScore,
        finalScore,
        tiersExecuted: {
          tier1: !sentinelResult.skipped,
          tier2: !weatherResult.skipped,
          tier3: !llmResult.skipped,
        },
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
    { claimId, previousScore: currentScore, finalScore, finalVerdict, flags, pipeline: "sequential-3-tier" },
    "Async fraud analysis completed"
  );
}
