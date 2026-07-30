import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Per-user rate limiter.
 *   - Authenticated: keyed by `req.user.id` → 10 req/min per user
 *   - Unauthenticated: keyed by validated IP → 3 req/min per IP
 *
 * Enable by setting RATE_LIMIT_ENABLED=true in production.
 * Disabled by default so local dev is frictionless.
 */

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

function getUserKey(req: any): string {
  if (req.user?.id) return `user:${req.user.id}`;
  return ipKeyGenerator(req);
}

function getAuthKey(req: any): string {
  if (req.user?.id) return `auth:user:${req.user.id}`;
  return `auth:${ipKeyGenerator(req)}`;
}

/**
 * General API rate limiter — 10 req/min per user, 3 req/min per IP (anon)
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req: any) => (req.user?.id ? 10 : 3),
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

/**
 * Auth rate limiter (login / register) — 5 req/min per user/IP
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: getAuthKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED,
  message: {
    status: "error",
    message: "Too many auth attempts, please try again later",
  },
});

/**
 * Rate limiter for document uploads — 20 req/h per user, 5 req/h per IP (anon)
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req: any) => (req.user?.id ? 20 : 5),
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !RATE_LIMIT_ENABLED,
  message: {
    status: "error",
    message: "Too many uploads, please try again later",
  },
});

/**
 * No-limit rate limiter for internal/dev routes
 */
export const noLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: () => true,
  skipFailedRequests: true,
  standardHeaders: false,
  legacyHeaders: false,
});
