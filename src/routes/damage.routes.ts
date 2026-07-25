import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as damageController from "../controllers/damage.controller";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.post("/calculate/:claimId", requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), damageController.calculateDamage);
router.get("/:claimId", requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN", "FARMER"), damageController.getDamageAssessment);

export default router;
