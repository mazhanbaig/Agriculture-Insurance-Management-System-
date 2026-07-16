import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as policyController from "../controllers/policies.controller";
import { validate } from "../middleware/validate";
import { purchasePolicySchema } from "../validators/policies.validator";

const router = Router();
router.use(requireAuth);
router.post("/purchase", requireRole("FARMER"), validate(purchasePolicySchema), policyController.purchasePolicy);
router.get("/my", requireRole("FARMER"), policyController.listMyPolicies);
router.get("/my/:id", requireRole("FARMER"), policyController.getPolicy);
export default router;
