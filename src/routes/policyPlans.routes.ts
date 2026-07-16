import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as policyPlanController from "../controllers/policyPlans.controller";
import { validate } from "../middleware/validate";
import { createPolicyPlanSchema, updatePolicyPlanSchema, quotePremiumSchema } from "../validators/policyPlans.validator";

const router = Router();
router.use(requireAuth);

router.get("/", policyPlanController.listPlans);
router.get("/:id", policyPlanController.getPlan);
router.post("/quote", requireRole("FARMER"), validate(quotePremiumSchema), policyPlanController.calculateQuote);
router.post("/", requireRole("UNDERWRITER", "ADMIN"), validate(createPolicyPlanSchema), policyPlanController.createPlan);
router.patch("/:id", requireRole("UNDERWRITER", "ADMIN"), validate(updatePolicyPlanSchema), policyPlanController.updatePlan);
export default router;
