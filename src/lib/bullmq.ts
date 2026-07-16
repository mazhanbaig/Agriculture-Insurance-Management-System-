import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";

const connection = redis;

// --- Queues ---

const OCR_QUEUE_NAME = "ocr";
const NOTIFICATION_QUEUE_NAME = "notification";

export const ocrQueue = new Queue(OCR_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// --- Worker definitions (processors are in src/jobs/) ---

export function createOcrWorker(
  processor: (job: Job) => Promise<void>
): Worker {
  return new Worker(OCR_QUEUE_NAME, processor, { connection });
}

export function createNotificationWorker(
  processor: (job: Job) => Promise<void>
): Worker {
  return new Worker(NOTIFICATION_QUEUE_NAME, processor, { connection });
}
