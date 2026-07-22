import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as platformController from "../controllers/platform.controller";
import { validate } from "../middleware/validate";
import { createTenantSchema, signupTenantSchema, updateTenantSchema, seedPlansSchema } from "../validators/platform.validator";

const router = Router();

// ─── Public Routes (no auth) ──────────────────────────────────────
router.post("/tenants/signup", validate(signupTenantSchema), platformController.signupTenant);

// ─── PLATFORM_ADMIN Routes ────────────────────────────────────────
router.use(requireAuth);
router.use(requireRole("PLATFORM_ADMIN"));

router.post("/tenants", validate(createTenantSchema), platformController.createTenant);
router.get("/tenants", platformController.listTenants);
router.get("/tenants/:id", platformController.getTenant);
router.patch("/tenants/:id", validate(updateTenantSchema), platformController.updateTenant);
router.delete("/tenants/:id", platformController.deactivateTenant);
router.patch("/tenants/:id/approve", platformController.approveTenant);
router.patch("/tenants/:id/suspend", platformController.suspendTenant);
router.post("/tenants/:id/seed", validate(seedPlansSchema), platformController.seedTenantPlans);

export default router;
