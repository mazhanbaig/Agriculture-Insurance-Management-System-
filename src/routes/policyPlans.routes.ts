import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as policyPlanController from "../controllers/policyPlans.controller";
import { validate } from "../middleware/validate";
import { createPolicyPlanSchema, updatePolicyPlanSchema, quotePremiumSchema } from "../validators/policyPlans.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.get("/", policyPlanController.listPlans);
router.get("/:id", policyPlanController.getPlan);
router.post("/quote", requireRole("FARMER"), validate(quotePremiumSchema), policyPlanController.calculateQuote);
router.post("/", requireRole("UNDERWRITER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(createPolicyPlanSchema), policyPlanController.createPlan);
router.patch("/:id", requireRole("UNDERWRITER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(updatePolicyPlanSchema), policyPlanController.updatePlan);
export default router;
