/**
 * Railway Cron Entry — Monthly Billing Invoice Generation
 *
 * Runs on the 1st of every month at 02:00 AM via Railway's cron scheduler.
 * This cron's ONLY job is to enqueue the billing job.
 * The permanent "worker" service processes it in the background.
 *
 * Railway cron services MUST exit after each run (process.exit(0)).
 * See railway.toml → billing-cron service.
 */

import { Queue } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { checkRedisConnection } from "../lib/redis";
import pino from "pino";

const logger = pino({ name: "cron:billing" });

async function run(): Promise<void> {
  logger.info("Monthly billing cron started");

  // 1. Verify Redis connection
  await checkRedisConnection();

  // 2. Calculate billing period (previous month)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  logger.info({
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  }, "Billing period");

  // 3. Enqueue a billing job — the permanent worker processes it
  const billingQueue = new Queue("billing", {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });

  const job = await billingQueue.add(
    "monthly-billing",
    {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
    {
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  logger.info({ jobId: job.id }, "Monthly billing job enqueued — worker will process");

  // 4. Close connections and exit (required by Railway cron)
  await billingQueue.close();
  await prisma.$disconnect();
  redis.disconnect();

  logger.info("Monthly billing cron completed");
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, "Monthly billing cron failed");
  prisma.$disconnect().catch(() => {});
  redis.disconnect();
  process.exit(1);
});
