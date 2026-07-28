import rateLimit from "express-rate-limit";

/**
 * Master toggle — set to TRUE when going to production to enable real rate limits.
 * During development (FALSE) this prevents any rate limiting from blocking your workflow.
 */
const RATE_LIMIT_ENABLED = false;

// When enabled, these are the production-ready values for thousands of users
const PRODUCTION_LIMITS = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 10,000 requests per 15 min → ~11 req/sec sustained
  },
  auth: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1,000 login/register attempts per minute
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5000, // 5,000 uploads per hour
  },
};

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: PRODUCTION_LIMITS.api.windowMs,
  max: PRODUCTION_LIMITS.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED, // ✅ Skipped during development
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

/**
 * Auth rate limiter (login / register)
 */
export const authLimiter = rateLimit({
  windowMs: PRODUCTION_LIMITS.auth.windowMs,
  max: PRODUCTION_LIMITS.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED, // ✅ Skipped during development
  message: {
    status: "error",
    message: "Too many auth attempts, please try again later",
  },
});

/**
 * Rate limiter for document uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: PRODUCTION_LIMITS.upload.windowMs,
  max: PRODUCTION_LIMITS.upload.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED, // ✅ Skipped during development
  message: {
    status: "error",
    message: "Too many uploads, please try again later",
  },
});

/**
 * No-limit rate limiter for internal/dev routes
 * Always skips regardless of the toggle
 */
export const noLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: () => true, // Always passes through
  skipFailedRequests: true,
  standardHeaders: false,
  legacyHeaders: false,
});
