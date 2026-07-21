import { Job, Queue, Worker } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { compareNDVI } from "../lib/sentinel";
import { generateClaimNumber } from "../utils/generators";
import { notificationQueue, autoTriggerQueue, fraudQueue } from "../lib/bullmq";
import { mergeAutoTriggerConfig, type AutoTriggerConfig } from "../config/autoTriggerConfig";
import { enqueueAsyncFraudAnalysis, runSyncForensics } from "../services/fraud.service";
import { checkWeatherNow } from "../lib/weather";
import logger from "../utils/logger";

// ─── Monitoring counters ──────────────────────────────────────────────

interface AutoTriggerStats {
  policiesChecked: number;
  autoTriggerEnabled: number;
  ndviDataAvailable: number;
  thresholdBreached: number;
  weatherConfirmed: number;
  claimsCreated: number;
  claimsAutoApproved: number;
  errors: number;
  totalDurationMs: number;
}

function createStats(): AutoTriggerStats {
  return {
    policiesChecked: 0,
    autoTriggerEnabled: 0,
    ndviDataAvailable: 0,
    thresholdBreached: 0,
    weatherConfirmed: 0,
    claimsCreated: 0,
    claimsAutoApproved: 0,
    errors: 0,
    totalDurationMs: 0,
  };
}

function logStats(stats: AutoTriggerStats, tenantId?: string): void {
  logger.info({
    tenantId,
    ...stats,
    msg: "Auto-trigger batch completed",
  });
}

// ─── Weather check with retry ─────────────────────────────────────────

interface WeatherResult {
  confirmed: boolean;
  event?: string;
  data?: any;
}

/**
 * Check if weather confirms a disaster event at the given location.
 * Uses lat/lon coordinates from the land parcel for more accurate results.
 * Auto-trigger monitors CURRENT conditions (NDVI drop is happening now),
 * so current weather check is appropriate here.
 */
async function checkWeatherConfirmation(
  lat: number | null | undefined,
  lon: number | null | undefined
): Promise<WeatherResult> {
  try {
    const result = await checkWeatherNow(lat, lon);
    return {
      confirmed: result.confirmed,
      event: result.event,
      data: result.data,
    };
  } catch {
    return { confirmed: false };
  }
}

// ─── Policy auto-trigger check ────────────────────────────────────────

/**
 * Run the auto-trigger check for a single active policy.
 * This fetches NDVI data, checks weather, creates claim if conditions met,
 * then enqueues fraud analysis.
 */
async function checkPolicyAutoTrigger(
  policyId: string,
  tenantId: string,
  stats: AutoTriggerStats
): Promise<void> {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, tenantId, status: "ACTIVE" },
    include: {
      policyPlan: true,
      landParcel: true,
      farmer: true,
    },
  });

  if (!policy) return;
  stats.policiesChecked++;

  if (!policy.landParcel?.latitude || !policy.landParcel?.longitude) return;

  // Resolve auto-trigger config from the policy plan's config
  const planConfig = policy.policyPlan?.config as Record<string, any> | null;
  const rawAutoTrigger = planConfig?.autoTrigger as Partial<AutoTriggerConfig> | undefined;
  const autoTriggerConfig = mergeAutoTriggerConfig(rawAutoTrigger);

  if (!autoTriggerConfig.enabled) return;
  stats.autoTriggerEnabled++;

  // Get NDVI data with retry built into compareNDVI
  const ndviResult = await compareNDVI(
    policy.landParcel.latitude,
    policy.landParcel.longitude,
    new Date(),
    autoTriggerConfig.ndviThreshold
  );

  if (!ndviResult.ndviPre || !ndviResult.ndviPost) {
    logger.info({ policyId }, "NDVI data unavailable for auto-trigger check");
    return;
  }
  stats.ndviDataAvailable++;

  const ndviDrop = ndviResult.ndviPre - ndviResult.ndviPost;

  // Check NDVI threshold
  if (!ndviResult.thresholdBreached) {
    await prisma.autoTriggerLog.create({
      data: {
        tenantId, policyId,
        landParcelId: policy.landParcel.id,
        ndviPre: ndviResult.ndviPre, ndviPost: ndviResult.ndviPost, ndviDrop,
        triggerMatched: false,
      },
    });
    return;
  }
  stats.thresholdBreached++;

  // Weather verification
  let weatherConfirmed = !autoTriggerConfig.weatherCheck;
  let weatherEvent: string | undefined;
  let weatherData: any = null;

  if (autoTriggerConfig.weatherCheck) {
    const weatherResult = await checkWeatherConfirmation(
      policy.landParcel?.latitude,
      policy.landParcel?.longitude
    );
    weatherConfirmed = weatherResult.confirmed;
    weatherEvent = weatherResult.event;
    weatherData = weatherResult.data;
  }

  if (autoTriggerConfig.weatherCheck && !weatherConfirmed) {
    await prisma.autoTriggerLog.create({
      data: {
        tenantId, policyId,
        landParcelId: policy.landParcel.id,
        ndviPre: ndviResult.ndviPre, ndviPost: ndviResult.ndviPost, ndviDrop,
        weatherEvent, weatherData,
        triggerMatched: false,
      },
    });
    logger.info({ policyId }, "Auto-trigger skipped: weather does not confirm disaster");
    return;
  }
  stats.weatherConfirmed++;

  // All conditions met — auto-create claim
  const claimNumber = generateClaimNumber();
  const claimedAmount = policy.coverageAmount * autoTriggerConfig.claimPercentage;

  const claim = await prisma.claim.create({
    data: {
      claimNumber, tenantId, policyId: policy.id, farmerId: policy.farmerId,
      incidentType: "AUTO_TRIGGERED",
      incidentDate: new Date(),
      incidentLocation: policy.landParcel.address,
      description: `Auto-triggered: NDVI dropped ${ndviDrop.toFixed(3)} (threshold: ${autoTriggerConfig.ndviThreshold}), weather: ${weatherEvent || "verified"}`,
      claimedAmount,
      status: "SUBMITTED",
      fraudScore: 0, fraudVerdict: "LOW",
    },
  });

  await prisma.claimStatusHistory.create({
    data: {
      claimId: claim.id,
      fromStatus: "SUBMITTED",
      toStatus: "SUBMITTED",
      changedByUserId: "",
      note: "Auto-triggered by satellite NDVI + weather monitoring",
    },
  });

  await prisma.autoTriggerLog.create({
    data: {
      tenantId, policyId, landParcelId: policy.landParcel.id,
      ndviPre: ndviResult.ndviPre, ndviPost: ndviResult.ndviPost, ndviDrop,
      weatherEvent, weatherData, triggerMatched: true, claimId: claim.id,
    },
  });

  await notificationQueue.add("auto-claim-created", {
    userId: policy.farmerId, type: "AUTO_CLAIM_CREATED",
    title: "Automatic Claim Created",
    message: `Automatic claim created for policy ${policy.policyNumber} due to detected vegetation loss. Claim #: ${claimNumber}`,
    relatedEntityType: "Claim", relatedEntityId: claim.id,
  });

  stats.claimsCreated++;
  logger.info({ policyId, claimId: claim.id, claimNumber, ndviDrop }, "Auto-triggered claim created");

  // Run sync fraud forensics (sync checks, < 100ms)
  try {
    const syncResult = await runSyncForensics(
      claim.id, tenantId, policy.farmerId,
      {
        policyId: policy.id,
        incidentDate: new Date().toISOString(),
        claimedAmount,
        estimatedLossPercentage: ndviDrop * 100,
      }
    );

    // Enqueue async fraud analysis (AI, satellite, weather deep checks)
    await enqueueAsyncFraudAnalysis(claim.id, tenantId);

    // Auto-approve if configured and fraud score is low
    if (
      autoTriggerConfig.autoApprove &&
      syncResult.score < autoTriggerConfig.autoApproveMaxScore
    ) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          status: "APPROVED",
          approvedAmount: claimedAmount,
          resolvedAt: new Date(),
        },
      });
      await prisma.claimStatusHistory.create({
        data: {
          claimId: claim.id,
          fromStatus: "SUBMITTED",
          toStatus: "APPROVED",
          changedByUserId: "",
          note: `Auto-approved: sync fraud score ${syncResult.score} < ${autoTriggerConfig.autoApproveMaxScore}`,
        },
      });
      await notificationQueue.add("auto-claim-approved", {
        userId: policy.farmerId, type: "AUTO_CLAIM_APPROVED",
        title: "Claim Auto-Approved",
        message: `Claim ${claimNumber} automatically approved. Payout processing.`,
        relatedEntityType: "Claim", relatedEntityId: claim.id,
      });
      stats.claimsAutoApproved++;
      logger.info({ claimId: claim.id, score: syncResult.score }, "Auto-triggered claim auto-approved");
    }
  } catch (error) {
    logger.error({ error, claimId: claim.id }, "Auto-trigger fraud analysis failed for claim — claim remains SUBMITTED for manual review");
    stats.errors++;
  }
}

// ─── Worker ───────────────────────────────────────────────────────────

const autoTriggerWorker = new Worker(
  "auto-trigger",
  async (job: Job) => {
    const startTime = Date.now();
    const { tenantId, policyIds }: { tenantId?: string; policyIds?: string[] } = job.data;
    const stats = createStats();

    logger.info({ jobId: job.id, policyCount: policyIds?.length }, "Processing auto-trigger batch");

    if (policyIds && policyIds.length > 0) {
      for (const policyId of policyIds) {
        try {
          await checkPolicyAutoTrigger(policyId, tenantId || "", stats);
        } catch (error) {
          logger.error({ error, policyId }, "Auto-trigger check failed");
          stats.errors++;
        }
      }
    } else {
      // Fetch all active policies. The query uses include to get policyPlan for config check.
      const policies = await prisma.policy.findMany({
        where: { ...(tenantId ? { tenantId } : {}), status: "ACTIVE" },
        include: { policyPlan: true, landParcel: true },
      });

      for (const policy of policies) {
        const planConfig = policy.policyPlan?.config as Record<string, any> | null;
        const rawAutoTrigger = planConfig?.autoTrigger as Partial<AutoTriggerConfig> | undefined;
        const autoTriggerConfig = mergeAutoTriggerConfig(rawAutoTrigger);

        if (autoTriggerConfig.enabled) {
          try {
            await checkPolicyAutoTrigger(policy.id, policy.tenantId, stats);
          } catch (error) {
            logger.error({ error, policyId: policy.id }, "Auto-trigger failed");
            stats.errors++;
          }
        }
      }
    }

    stats.totalDurationMs = Date.now() - startTime;
    logStats(stats, tenantId);
  },
  { connection: redis, concurrency: 3 }
);

autoTriggerWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Auto-trigger done"));
autoTriggerWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Auto-trigger failed"));

logger.info("Auto-trigger worker initialized (Phase 6 — retry + monitoring)");
export { autoTriggerWorker };

export async function scheduleAutoTriggerCheck(): Promise<void> {
  await autoTriggerQueue.add(
    "auto-trigger-batch",
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 } }
  );
  logger.info("Auto-trigger scheduled: every 6 hours");
}
