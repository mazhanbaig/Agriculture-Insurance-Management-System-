import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as tenantSettingsController from "../controllers/tenantSettings.controller";
import { validate } from "../middleware/validate";
import { updateSettingsSchema } from "../validators/tenantSettings.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.get("/", tenantSettingsController.getSettings);
router.patch("/", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), validate(updateSettingsSchema), tenantSettingsController.updateSettings);

// Fraud tier endpoints — stored in Tenant.config.fraudTier
router.get("/fraud-tier", tenantSettingsController.getFraudTier);
router.patch("/fraud-tier", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantSettingsController.updateFraudTier);

// Payment gateway settings
router.get("/payment-gateway", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantSettingsController.getPaymentGateway);
router.patch("/payment-gateway", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantSettingsController.updatePaymentGateway);

export default router;
