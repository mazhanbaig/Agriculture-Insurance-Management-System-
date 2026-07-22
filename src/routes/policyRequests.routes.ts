import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as policyRequestController from "../controllers/policyRequests.controller";
import { validate } from "../middleware/validate";
import {
  createPolicyRequestSchema,
  reviewPolicyRequestSchema,
} from "../validators/policyRequests.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

// Farmer: create a purchase request (replaces the disabled purchase endpoint)
router.post(
  "/",
  requireRole("FARMER"),
  validate(createPolicyRequestSchema),
  policyRequestController.createPolicyRequest
);

// Farmer & Staff: list requests
router.get(
  "/",
  requireRole("FARMER", "TENANT_ADMIN", "UNDERWRITER", "CLAIMS_OFFICER", "FIELD_AGENT", "PLATFORM_ADMIN"),
  policyRequestController.listPolicyRequests
);

// Farmer & Staff: get single request
router.get(
  "/:id",
  requireRole("FARMER", "TENANT_ADMIN", "UNDERWRITER", "CLAIMS_OFFICER", "PLATFORM_ADMIN"),
  policyRequestController.getPolicyRequest
);

// Staff: review (approve/reject) a request
router.patch(
  "/:id/review",
  requireRole("UNDERWRITER", "TENANT_ADMIN", "PLATFORM_ADMIN"),
  validate(reviewPolicyRequestSchema),
  policyRequestController.reviewPolicyRequest
);

// Staff: convert an approved request into a real Policy
router.post(
  "/:id/convert",
  requireRole("UNDERWRITER", "TENANT_ADMIN", "PLATFORM_ADMIN"),
  policyRequestController.convertPolicyRequest
);

export default router;
