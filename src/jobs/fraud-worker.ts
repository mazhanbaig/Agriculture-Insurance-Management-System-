import { Job, Worker } from "bullmq";
import { redis } from "../lib/redis";
import { runAsyncFraudAnalysis } from "../services/fraud.service";
import logger from "../utils/logger";

interface FraudJobData {
  claimId: string;
  tenantId: string;
}

/**
 * Fraud analysis worker.
 * Processes claims in the background: AI image checks, satellite NDVI, weather verification.
 */
const fraudWorker = new Worker<FraudJobData>(
  "fraud",
  async (job: Job<FraudJobData>) => {
    const { claimId, tenantId } = job.data;
    logger.info({ jobId: job.id, claimId }, "Processing fraud analysis job");

    try {
      await runAsyncFraudAnalysis(claimId, tenantId);
      logger.info({ jobId: job.id, claimId }, "Fraud analysis completed");
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

logger.info("Fraud analysis worker initialized");

export { fraudWorker };
