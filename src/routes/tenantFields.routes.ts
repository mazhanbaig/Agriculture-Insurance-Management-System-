import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import * as tenantFieldsController from "../controllers/tenantFields.controller";
import { createFieldSchema, updateFieldSchema } from "../validators/tenantFields.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

// — Management endpoints (TENANT_ADMIN, PLATFORM_ADMIN) —
router.get("/", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantFieldsController.listFields);
router.get("/:id", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantFieldsController.getField);
router.post("/", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), validate(createFieldSchema), tenantFieldsController.createField);
router.patch("/:id", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), validate(updateFieldSchema), tenantFieldsController.updateField);
router.delete("/:id", requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"), tenantFieldsController.deleteField);

export default router;
