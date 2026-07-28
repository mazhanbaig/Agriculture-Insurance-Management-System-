import pino from "pino";

/**
 * Application-wide logger instance.
 * Configured via LOG_LEVEL env variable (default: "info").
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  name: "aims",
});
