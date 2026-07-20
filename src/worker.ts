/**
 * Railway Worker Entry Point — Background BullMQ Workers
 *
 * This file starts ALL BullMQ workers as a single background process.
 * It does NOT start an HTTP server — only processes queue jobs:
 *   - fraud-worker:  AI image analysis, satellite NDVI, weather verification
 *   - notificationWorker:  In-app + email notifications (Nodemailer)
 *   - importWorker:  Bulk CSV/JSON import for policy plans & farmers
 *   - billingWorker:  Month-end invoice generation
 *   - auto-trigger-worker:  Satellite NDVI monitoring + auto-claim creation
 *
 * Deployed as the "worker" service on Railway (see railway.toml).
 * The process runs indefinitely, listening for jobs on all queues.
 */

import "./lib/prisma";
import "./lib/redis";
import pino from "pino";

const logger = pino({ name: "worker" });

async function start(): Promise<void> {
  logger.info("Background worker process starting...");

  // Dynamically import all workers — this registers them with BullMQ
  // and they begin listening on their respective queues immediately.
  try {
    require("./jobs/fraud-worker");
    logger.info("Fraud worker initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize fraud worker");
  }

  try {
    // notificationWorker.ts only exports a function — create the Worker here
    const { Worker } = await import("bullmq");
    const { redis } = await import("./lib/redis");
    const { processNotificationJob } = await import("./jobs/notificationWorker");
    new Worker("notification", processNotificationJob, { connection: redis, concurrency: 5 });
    logger.info("Notification worker initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize notification worker");
  }

  try {
    // importWorker.ts only exports a function — create the Worker here
    const { Worker } = await import("bullmq");
    const { redis } = await import("./lib/redis");
    const { processImportJob } = await import("./jobs/importWorker");
    new Worker("import", processImportJob, { connection: redis, concurrency: 2 });
    logger.info("Import worker initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize import worker");
  }

  try {
    const { billingWorker } = await import("./jobs/billingWorker");
    logger.info("Billing worker initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize billing worker");
  }

  try {
    const { autoTriggerWorker } = await import("./jobs/auto-trigger-worker");
    logger.info("Auto-trigger worker initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize auto-trigger worker");
  }

  logger.info("All workers initialized — listening for jobs...");

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received — shutting down workers");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received — shutting down workers");
    process.exit(0);
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start worker process");
  process.exit(1);
});
