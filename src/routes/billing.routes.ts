import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import * as billingController from "../controllers/billing.controller";
import {
  usageSummarySchema,
  listInvoicesSchema,
  payInvoiceSchema,
  generateInvoiceSchema,
} from "../validators/billing.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

// Subscription management
router.post("/subscribe", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), billingController.subscribe);
router.post("/cancel", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), billingController.cancelSubscription);
router.get("/status", billingController.getSubscriptionStatus);

// Usage & Invoices
router.get("/usage", billingController.getUsageSummary);
router.get("/invoices", validate(listInvoicesSchema), billingController.listInvoices);
router.get("/invoices/:id", billingController.getInvoice);
router.post("/invoices/:id/pay", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), validate(payInvoiceSchema), billingController.payInvoice);
router.post("/invoices/generate", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), validate(generateInvoiceSchema), billingController.generateInvoice);

export default router;
