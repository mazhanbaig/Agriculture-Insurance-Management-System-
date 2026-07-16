import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as importController from "../controllers/import.controller";
import { validate } from "../middleware/validate";
import { importPolicyPlansSchema, importFarmersPoliciesSchema } from "../validators/import.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);
router.use(requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"));

router.post("/policy-plans", validate(importPolicyPlansSchema), importController.importPolicyPlans);
router.post("/farmers-policies", validate(importFarmersPoliciesSchema), importController.importFarmersPolicies);

export default router;
