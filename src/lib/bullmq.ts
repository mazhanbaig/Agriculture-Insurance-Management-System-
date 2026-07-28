import { Queue } from "bullmq";
import { redis } from "./redis";

const connection = redis;

// --- Queues ---

const OCR_QUEUE_NAME = "ocr";
const NOTIFICATION_QUEUE_NAME = "notification";
const IMPORT_QUEUE_NAME = "import";
const FRAUD_QUEUE_NAME = "fraud";
const AUTO_TRIGGER_QUEUE_NAME = "auto-trigger";

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

export const importQueue = new Queue(IMPORT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const fraudQueue = new Queue(FRAUD_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const autoTriggerQueue = new Queue(AUTO_TRIGGER_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});


