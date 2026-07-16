import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as platformController from "../controllers/platform.controller";
import { validate } from "../middleware/validate";
import { createTenantSchema, updateTenantSchema, seedPlansSchema } from "../validators/platform.validator";

const router = Router();
router.use(requireAuth);
router.use(requireRole("PLATFORM_ADMIN"));

router.post("/tenants", validate(createTenantSchema), platformController.createTenant);
router.get("/tenants", platformController.listTenants);
router.get("/tenants/:id", platformController.getTenant);
router.patch("/tenants/:id", validate(updateTenantSchema), platformController.updateTenant);
router.delete("/tenants/:id", platformController.deactivateTenant);
router.post("/tenants/:id/seed", validate(seedPlansSchema), platformController.seedTenantPlans);

export default router;
