import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import pino from "pino";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { resolveTenant } from "./middleware/auth";
import { getNeonPrisma } from "./lib/prisma";
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
import billingRoutes from "./routes/billing.routes";

const logger = pino();
const app = express();

app.use(helmet());
app.use(cors());
// Stripe webhook needs raw body before JSON parsing
app.use("/api/v1/billing/webhook", express.raw({ type: "application/json" }), handleWebhook);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger, quietReqLogger: true }));
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

app.use(errorHandler);

async function start() {
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
  }
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});

export { app };
