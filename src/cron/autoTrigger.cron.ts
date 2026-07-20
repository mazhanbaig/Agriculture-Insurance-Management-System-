/**
 * Railway Cron Entry — Auto-Trigger Check
 *
 * Runs every 6 hours via Railway's cron scheduler.
 * This cron's ONLY job is to enqueue a batch to the auto-trigger queue.
 * The permanent "worker" service processes it in the background.
 *
 * Railway cron services MUST exit after each run (process.exit(0)).
 * See railway.toml → auto-trigger-cron service.
 */

import { Queue } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { checkRedisConnection } from "../lib/redis";
import pino from "pino";

const logger = pino({ name: "cron:auto-trigger" });

async function run(): Promise<void> {
  logger.info("Auto-trigger cron started");

  // 1. Verify Redis connection
  await checkRedisConnection();

  // 2. Enqueue a batch job — the permanent worker processes it
  const autoTriggerQueue = new Queue("auto-trigger", {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    },
  });

  const job = await autoTriggerQueue.add(
    "auto-trigger-batch",
    {},
    {
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  logger.info({ jobId: job.id }, "Auto-trigger batch enqueued — worker will process");

  // 3. Close connections and exit (required by Railway cron)
  await autoTriggerQueue.close();
  await prisma.$disconnect();
  redis.disconnect();

  logger.info("Auto-trigger cron completed");
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, "Auto-trigger cron failed");
  prisma.$disconnect().catch(() => {});
  redis.disconnect();
  process.exit(1);
});
