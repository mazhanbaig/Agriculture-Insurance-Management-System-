import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as visitsController from "../controllers/visits.controller";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.get("/", requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "FIELD_AGENT", "TENANT_ADMIN", "PLATFORM_ADMIN"), visitsController.listVisits);
router.post("/:claimId", requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), visitsController.scheduleVisit);
router.patch("/:visitId/complete", requireRole("FIELD_AGENT", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), visitsController.completeVisit);
router.patch("/:visitId/cancel", requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), visitsController.cancelVisit);

export default router;
