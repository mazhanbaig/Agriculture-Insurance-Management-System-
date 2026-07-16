import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as claimController from "../controllers/claims.controller";
import { validate } from "../middleware/validate";
import { createClaimSchema, assignClaimSchema, updateClaimStatusSchema } from "../validators/claims.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.post("/", requireRole("FARMER"), validate(createClaimSchema), claimController.createClaim);
router.get("/my", requireRole("FARMER"), claimController.listMyClaims);
router.get("/my/:id", requireRole("FARMER"), claimController.getClaim);
router.get("/", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), claimController.listAllClaims);
router.get("/:id", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), claimController.getClaim);
router.patch("/:id/assign", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(assignClaimSchema), claimController.assignClaim);
router.patch("/:id/status", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(updateClaimStatusSchema), claimController.updateClaimStatus);
export default router;
