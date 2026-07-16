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

export default router;
