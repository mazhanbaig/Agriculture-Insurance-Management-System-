import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as adminController from "../controllers/admin.controller";
import { validate } from "../middleware/validate";
import { createStaffUserSchema } from "../validators/admin.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);
router.use(requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"));
router.post("/staff", validate(createStaffUserSchema), adminController.createStaffUser);
router.get("/staff", adminController.listStaffUsers);
router.patch("/staff/:id/toggle-status", adminController.toggleUserStatus);
router.get("/dashboard", adminController.getDashboard);
router.get("/analytics/claims", adminController.getClaimsAnalytics);
export default router;
