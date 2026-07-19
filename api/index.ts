/**
 * Vercel Serverless Entry Point
 *
 * This file exports the Express app for Vercel's serverless runtime.
 * It imports all routes and middleware from src/ but skips:
 * - Startup environment variable validation (Vercel sets these at runtime)
 * - process.exit() calls (would kill the serverless function)
 * - Background worker initialization (BullMQ needs persistent connections)
 * - Server listen() calls (Vercel handles HTTP natively)
 *
 * Background jobs (fraud, auto-trigger, billing, notifications) will NOT run
 * on Vercel. For full functionality, deploy to Railway or a VPS.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "crypto";
import { apiLimiter } from "../src/middleware/rateLimiter";
import { errorHandler } from "../src/middleware/errorHandler";
import { resolveTenant } from "../src/middleware/auth";
import { handleWebhook } from "../src/controllers/billingWebhook.controller";

import authRoutes from "../src/routes/auth.routes";
import farmerRoutes from "../src/routes/farmers.routes";
import landParcelRoutes from "../src/routes/landParcels.routes";
import policyPlanRoutes from "../src/routes/policyPlans.routes";
import policyRoutes from "../src/routes/policies.routes";
import claimRoutes from "../src/routes/claims.routes";
import documentRoutes from "../src/routes/documents.routes";
import paymentRoutes from "../src/routes/payments.routes";
import notificationRoutes from "../src/routes/notifications.routes";
import adminRoutes from "../src/routes/admin.routes";
import platformRoutes from "../src/routes/platform.routes";
import tenantSettingsRoutes from "../src/routes/tenantSettings.routes";
import importRoutes from "../src/routes/import.routes";
import webhookRoutes from "../src/routes/webhook.routes";
import billingRoutes from "../src/routes/billing.routes";
import tenantFieldRoutes from "../src/routes/tenantFields.routes";
import iamRoutes from "../src/routes/iam.routes";

const app = express();

// Request ID middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  (req as any).requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("x-request-id", (req as any).requestId);
  next();
});

// Security & parsing middleware
app.use(helmet());
app.use(cors());

// Webhooks need raw body before JSON parsing
app.use("/api/v1/billing/webhook", express.raw({ type: "application/json" }), handleWebhook);
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);
app.use(resolveTenant);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// Error handler (must be last)
app.use(errorHandler);

export default app;
