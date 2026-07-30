import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { apiLimiter } from "./middleware/rateLimiter";
import { resolveTenant } from "./middleware/tenant";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./utils/logger";
import authRoutes from "./routes/auth.routes";
import farmerRoutes from "./routes/farmers.routes";
import landParcelRoutes from "./routes/landParcels.routes";
import policyPlanRoutes from "./routes/policyPlans.routes";
import policyRoutes from "./routes/policies.routes";
import claimRoutes from "./routes/claims.routes";
import documentRoutes from "./routes/documents.routes";
import paymentRoutes from "./routes/payments.routes";
import notificationRoutes from "./routes/notifications.routes";
import adminRoutes from "./routes/admin.routes";
import platformRoutes from "./routes/platform.routes";
import tenantSettingsRoutes from "./routes/tenantSettings.routes";
import importRoutes from "./routes/import.routes";
import billingRoutes from "./routes/billing.routes";
import tenantFieldRoutes from "./routes/tenantFields.routes";
import iamRoutes from "./routes/iam.routes";
import policyRequestRoutes from "./routes/policyRequests.routes";
import chatRoutes from "./routes/chat.routes";
import visitRoutes from "./routes/visits.routes";
import damageRoutes from "./routes/damage.routes";
import webhookRoutes from "./routes/webhook.routes";

// Stripe webhook handler — imported outside the mount to ensure it's available
import { handleWebhook } from "./controllers/billing.controller";

const app = express();
export default app;

// Trust proxy for rate limiter IP detection behind Railway/reverse proxy
app.set("trust proxy", 1);

// -------------
// GLOBAL CONFIG
// -------------

// Log startup
logger.info({ nodeEnv: process.env.NODE_ENV }, "Starting server");
logger.info(
  { frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000" },
  "Frontend URL"
);

// Verify critical env vars are set
const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "NEXTAUTH_SECRET",
  "FRONTEND_URL",
  "REDIS_URL",
];
const missing: string[] = [];
for (const v of requiredEnvVars) {
  if (!process.env[v]) missing.push(v);
}
if (missing.length > 0) {
  logger.warn({ missing }, "Missing environment variables — some features may not work");
} else {
  logger.info("All required environment variables are set");
}

// Track whether we've triggered the setImmediate startup check
let _startupCheckTriggered = false;

/**
 * Request ID middleware – assigns a unique ID to every request
 * for tracing through logs.
 */
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  _res.setHeader("x-request-id", req.requestId);
  next();
});

app.use(helmet());

// Health check — must be before auth middleware but after helmet for security headers
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(",") || ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));
// Stripe webhook needs raw body before JSON parsing
// Mount raw-body parser for webhook endpoints BEFORE the JSON middleware
app.use("/api/v1/billing/webhook", express.raw({ type: "application/json" }), handleWebhook);
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({
  logger,
  quietReqLogger: true,
  customProps: (req) => ({
    requestId: (req as any).requestId,
  }),
}));
app.use(apiLimiter);
app.use(resolveTenant);

// API routes

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/farmers", farmerRoutes);
app.use("/api/v1/land-parcels", landParcelRoutes);
app.use("/api/v1/policy-plans", policyPlanRoutes);
app.use("/api/v1/policies", policyRoutes);
app.use("/api/v1/claims", claimRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/platform", platformRoutes);
app.use("/api/v1/settings", tenantSettingsRoutes);
app.use("/api/v1/import", importRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/settings/fields", tenantFieldRoutes);
app.use("/api/v1/iam", iamRoutes);
app.use("/api/v1/policy-requests", policyRequestRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/visits", visitRoutes);
app.use("/api/v1/damage", damageRoutes);

// ════════════════════════════════════════════
// DEV ROUTES — bypass Supabase Auth entirely
// Only available when NODE_ENV !== "production"
// ════════════════════════════════════════════
if (process.env.NODE_ENV !== "production") {
  // Dynamic import so the module is only loaded in dev
  const devAuthRoutes = require("./routes/dev-auth.routes").default;
  app.use("/api/v1/dev/auth", devAuthRoutes);
  logger.info("🧪 Dev auth routes registered — bypass Supabase rate limits");
}

// Initialize background workers (only in non-test mode)
// Wrapped in try/catch to prevent startup crashes (e.g. during Railway health checks)
if (process.env.NODE_ENV !== "test") {
  try {
    require("./jobs/fraud-worker");
    require("./jobs/auto-trigger-worker");
    require("./jobs/notificationWorker");
    require("./jobs/billingWorker");
    const { Worker } = require("bullmq");
    const { redis } = require("./lib/redis");
    const { processOcrJob } = require("./jobs/ocrWorker");
    new Worker("ocr", processOcrJob, { connection: redis, concurrency: 2 });
  } catch (err) {
    logger.error({ err }, "Failed to initialize background workers — continuing without them");
  }
}

// Error handler — must be last
app.use(errorHandler);

// Graceful shutdown
const start = () => {
  const port = process.env.PORT || 4000;
  const server = app.listen(port, () => {
    logger.info(`Server running on port ${port}`);

    // One-time startup check: log which env vars are actually configured vs mock
    if (!_startupCheckTriggered) {
      _startupCheckTriggered = true;
      setImmediate(async () => {
        try {
          const { prisma } = await import("./lib/prisma");
          await prisma.$queryRaw`SELECT 1`;
          logger.info("✅ Database connection successful");
        } catch (err) {
          logger.error({ err }, "❌ Database connection failed on startup");
        }

        try {
          const { supabase } = await import("./lib/supabase");
          const { error } = await supabase.auth.getSession();
          if (error) {
            logger.warn({ error: error.message }, "⚠️ Supabase connection issue — expected in local dev without full config");
          } else {
            logger.info("✅ Supabase connection successful");
          }
        } catch (err) {
          logger.warn({ err }, "⚠️ Supabase check failed — expected if Supabase env vars are partial");
        }
      });
    }
  });

  process.on("SIGINT", () => {
    logger.info("Shutting down gracefully...");
    server.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    logger.info("Shutting down gracefully...");
    server.close(() => process.exit(0));
  });
};

start();
