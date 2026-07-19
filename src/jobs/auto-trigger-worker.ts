import { Job, Queue, Worker } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { compareNDVI } from "../lib/sentinel";
import { generateClaimNumber } from "../utils/generators";
import { notificationQueue, autoTriggerQueue } from "../lib/bullmq";
import logger from "../utils/logger";

/**
 * Check if weather confirms a disaster event at the given location.
 */
async function checkWeatherConfirmation(location: string): Promise<{ confirmed: boolean; event?: string; data?: any }> {
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;
  if (!weatherApiKey) return { confirmed: false };

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${weatherApiKey}`;
    const response = await fetch(url);
    if (!response.ok) return { confirmed: false };

    const weatherData = (await response.json()) as any;
    const conditions = (weatherData.weather || []).map((w: any) => w.main).join(", ");
    const severeEvents = ["Thunderstorm", "Tornado", "Hurricane", "Extreme", "Flood", "Storm"];
    const isSevere = severeEvents.some((e) => conditions.includes(e));

    return { confirmed: isSevere, event: isSevere ? conditions : undefined, data: weatherData };
  } catch {
    return { confirmed: false };
  }
}

/**
 * Run the auto-trigger check for a single active policy.
 * This is called by the worker for each policy that has auto-trigger enabled.
 */
async function checkPolicyAutoTrigger(policyId: string, tenantId: string) {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, tenantId, status: "ACTIVE" },
    include: {
      policyPlan: true,
      landParcel: true,
      farmer: true,
    },
  });

  if (!policy) return;
  if (!policy.landParcel?.latitude || !policy.landParcel?.longitude) return;

  // Check if auto-trigger is configured in the policy plan
  const planConfig = policy.policyPlan?.config as { autoTrigger?: { enabled?: boolean; ndviThreshold?: number; weatherCheck?: boolean } } | null;
  const autoTriggerConfig = planConfig?.autoTrigger;
  if (!autoTriggerConfig?.enabled) return;

  const ndviThreshold = autoTriggerConfig.ndviThreshold || 0.3;
  const weatherCheckEnabled = autoTriggerConfig.weatherCheck !== false;

  // Get NDVI data
  const ndviResult = await compareNDVI(
    policy.landParcel.latitude,
    policy.landParcel.longitude,
    new Date(),
    ndviThreshold
  );

  if (!ndviResult.ndviPre || !ndviResult.ndviPost) {
    logger.info({ policyId }, "NDVI data unavailable for auto-trigger check");
    return;
  }

  const ndviDrop = ndviResult.ndviPre - ndviResult.ndviPost;

  // Check NDVI threshold first
  if (!ndviResult.thresholdBreached) {
    // Log non-trigger for audit
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

  // Weather verification (if enabled)
  let weatherConfirmed = !weatherCheckEnabled;
  let weatherEvent: string | undefined;
  let weatherData: any = null;

  if (weatherCheckEnabled && policy.landParcel.address) {
    const weatherResult = await checkWeatherConfirmation(policy.landParcel.address);
    weatherConfirmed = weatherResult.confirmed;
    weatherEvent = weatherResult.event;
    weatherData = weatherResult.data;
  }

  if (weatherCheckEnabled && !weatherConfirmed) {
    // Log as unmatched — weather didn't confirm the disaster
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

  // All conditions met — auto-create claim
  const claimNumber = generateClaimNumber();
  const claim = await prisma.claim.create({
    data: {
      claimNumber, tenantId, policyId: policy.id, farmerId: policy.farmerId,
      incidentType: "AUTO_TRIGGERED",
      incidentDate: new Date(),
      incidentLocation: policy.landParcel.address,
      description: `Auto-triggered: NDVI dropped ${ndviDrop.toFixed(3)}, weather: ${weatherEvent || "verified"}`,
      claimedAmount: policy.coverageAmount * 0.5,
      status: "SUBMITTED",
      fraudScore: 0, fraudVerdict: "LOW",
    },
  });

  await prisma.claimStatusHistory.create({
    data: { claimId: claim.id, fromStatus: "SUBMITTED", toStatus: "SUBMITTED", changedByUserId: "", note: "Auto-triggered by satellite NDVI + weather monitoring" },
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

  logger.info({ policyId, claimId: claim.id, claimNumber, ndviDrop }, "Auto-triggered claim created");

  // Auto-approve if fraud score is low
  if (claim.fraudScore !== null && claim.fraudScore !== undefined && claim.fraudScore < 30) {
    await prisma.claim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", approvedAmount: claim.claimedAmount, resolvedAt: new Date() },
    });
    await prisma.claimStatusHistory.create({
      data: { claimId: claim.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", changedByUserId: "", note: "Auto-approved: low fraud risk" },
    });
    await notificationQueue.add("auto-claim-approved", {
      userId: policy.farmerId, type: "AUTO_CLAIM_APPROVED",
      title: "Claim Auto-Approved",
      message: `Claim ${claimNumber} automatically approved. Payout processing.`,
      relatedEntityType: "Claim", relatedEntityId: claim.id,
    });
    logger.info({ claimId: claim.id }, "Auto-triggered claim auto-approved");
  }
}

const autoTriggerWorker = new Worker(
  "auto-trigger",
  async (job: Job) => {
    const { tenantId, policyIds }: { tenantId?: string; policyIds?: string[] } = job.data;
    logger.info({ jobId: job.id, policyCount: policyIds?.length }, "Processing auto-trigger batch");

    if (policyIds && policyIds.length > 0) {
      for (const policyId of policyIds) {
        try { await checkPolicyAutoTrigger(policyId, tenantId || ""); }
        catch (error) { logger.error({ error, policyId }, "Auto-trigger check failed"); }
      }
    } else {
      const policies = await prisma.policy.findMany({
        where: { ...(tenantId ? { tenantId } : {}), status: "ACTIVE" },
        include: { policyPlan: true },
      });
      for (const policy of policies) {
        const policyPlanConfig = policy.policyPlan?.config as { autoTrigger?: { enabled?: boolean } } | null;
        if (policyPlanConfig?.autoTrigger?.enabled) {
          try { await checkPolicyAutoTrigger(policy.id, policy.tenantId); }
          catch (error) { logger.error({ error, policyId: policy.id }, "Auto-trigger failed"); }
        }
      }
    }
    logger.info({ jobId: job.id }, "Auto-trigger batch completed");
  },
  { connection: redis, concurrency: 3 }
);

autoTriggerWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Auto-trigger done"));
autoTriggerWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Auto-trigger failed"));

logger.info("Auto-trigger worker initialized");
export { autoTriggerWorker };

export async function scheduleAutoTriggerCheck(): Promise<void> {
  await autoTriggerQueue.add("auto-trigger-batch", {}, { repeat: { every: 6 * 60 * 60 * 1000 } });
  logger.info("Auto-trigger scheduled: every 6 hours");
}
