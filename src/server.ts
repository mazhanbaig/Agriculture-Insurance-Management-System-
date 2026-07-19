import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import pino from "pino";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler, AppError } from "./middleware/errorHandler";
import { resolveTenant } from "./middleware/auth";
import { getNeonPrisma } from "./lib/prisma";
import { redis, checkRedisConnection } from "./lib/redis";
import { handleWebhook } from "./controllers/billingWebhook.controller";

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
import webhookRoutes from "./routes/webhook.routes";
import billingRoutes from "./routes/billing.routes";
import tenantFieldRoutes from "./routes/tenantFields.routes";

const logger = pino({ name: "aims" });
const app = express();

/**
 * Required environment variables — validated on startup.
 * Exit immediately if any are missing.
 */
const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "REDIS_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "OPENROUTER_API_KEY",
] as const;

function validateEnvVars(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    logger.error({ missing }, "Missing required environment variables");
    console.error(
      `❌ FATAL: Missing required environment variables: ${missing.join(", ")}\n` +
      "Please create a .env file with these variables. See .env.example for reference."
    );
    process.exit(1);
  }
  logger.info("All required environment variables are set");
}

// Skip validation in test mode — tests set env vars dynamically
if (process.env.NODE_ENV !== "test") {
  validateEnvVars();
}


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
app.use(cors());
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// Initialize background workers (only in non-test mode)
if (process.env.NODE_ENV !== "test") {
  require("./jobs/fraud-worker");
  require("./jobs/auto-trigger-worker");
  require("./jobs/notificationWorker");
}
app.use(errorHandler);

async function start() {
  // Verify Redis connectivity on boot
  try {
    await checkRedisConnection();
    logger.info("Redis connection verified successfully");
  } catch (err) {
    logger.error({ err }, "Redis connection failed — BullMQ queues will not work");
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }

  if (process.env.NODE_ENV === "production") {
    const neonPrisma = await getNeonPrisma();
    // Replace the global prisma instance with the Neon-adapted one
    const prismaModule = await import("./lib/prisma");
    (prismaModule as any).prisma = neonPrisma;
    logger.info("Neon serverless adapter initialized");
  }

  const PORT = parseInt(process.env.PORT || "4000", 10);
  if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
    // Schedule the auto-trigger cron (every 6 hours)
    try {
      const { scheduleAutoTriggerCheck } = await import("./jobs/auto-trigger-worker");
      await scheduleAutoTriggerCheck();
    } catch (err) {
      logger.warn({ err }, "Failed to schedule auto-trigger check — cron not started");
    }
  }
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});

export { app };
