import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as farmerController from "../controllers/farmers.controller";
import { validate } from "../middleware/validate";
import { createFarmerSchema, updateFarmerSchema } from "../validators/farmers.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

// Public schema endpoint — any authenticated user can view
router.get("/fields", farmerController.getFieldSchema);

// Admin listing (TENANT_ADMIN, PLATFORM_ADMIN can list/get all farmers)
router.get("/", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), farmerController.listFarmers);
router.get("/:id", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), farmerController.getFarmer);

// Farmer own profile
router.use(requireRole("FARMER"));
router.get("/profile", farmerController.getProfile);
router.post("/profile", validate(createFarmerSchema), farmerController.createProfile);
router.patch("/profile", validate(updateFarmerSchema), farmerController.updateProfile);
export default router;
