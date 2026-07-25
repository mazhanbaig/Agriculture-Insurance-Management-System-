import { Job, Worker } from "bullmq";
import { redis } from "../lib/redis";
import { runAsyncFraudAnalysis } from "../services/fraud.service";
import { healthCheck } from "../lib/sentinel";
import logger from "../utils/logger";

interface FraudJobData {
  claimId: string;
  tenantId: string;
}

const fraudWorker = new Worker<FraudJobData>(
  "fraud",
  async (job: Job<FraudJobData>) => {
    const { claimId, tenantId } = job.data;
    logger.info({ jobId: job.id, claimId }, "Processing fraud analysis job");

    const ndviHealth = await healthCheck();
    if (!ndviHealth.ok) {
      logger.warn({
        jobId: job.id,
        claimId,
        ndviHealth: ndviHealth.message,
      }, "Copernicus API unhealthy — fraud will use weather + LLM fallback");
    }

    try {
      await runAsyncFraudAnalysis(claimId, tenantId);
      logger.info({
        jobId: job.id,
        claimId,
        ndviAvailable: ndviHealth.ok,
        ndviLatencyMs: ndviHealth.latencyMs,
        ndviQuotaRemaining: ndviHealth.quotaLimit - ndviHealth.quotaUsed,
      }, "Fraud analysis completed");
    } catch (error) {
      logger.error({ error, jobId: job.id, claimId }, "Fraud analysis failed");
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

fraudWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, claimId: job.data.claimId }, "Fraud job completed");
});

fraudWorker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, claimId: job?.data?.claimId, error },
    "Fraud job failed"
  );
});

logger.info("Fraud analysis worker initialized (Copernicus CDSE)");

export { fraudWorker };
