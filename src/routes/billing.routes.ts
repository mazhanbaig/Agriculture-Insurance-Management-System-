import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as billingController from "../controllers/billing.controller";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.post("/subscribe", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), billingController.subscribe);
router.post("/cancel", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), billingController.cancelSubscription);
router.get("/status", billingController.getSubscriptionStatus);

export default router;
