import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import { requireFarmerPaymentsEnabled } from "../middleware/featureFlags";
import * as policyController from "../controllers/policies.controller";
import { validate } from "../middleware/validate";
import { purchasePolicySchema } from "../validators/policies.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);
router.post("/purchase", requireFarmerPaymentsEnabled, requireRole("FARMER"), validate(purchasePolicySchema), policyController.purchasePolicy);
router.get("/my", requireRole("FARMER"), policyController.listMyPolicies);
router.get("/my/:id", requireRole("FARMER"), policyController.getPolicy);

// Staff/admin can also list/get policies
router.get("/", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), policyController.listAllPolicies);
router.get("/:id", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), policyController.getAnyPolicy);
export default router;
