import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import * as iamController from "../controllers/iam.controller";
import {
  createCustomRoleSchema,
  updateCustomRoleSchema,
  assignCustomRoleSchema,
} from "../validators/iam.validator";

const router = Router();

router.use(requireAuth);
router.use(requireTenantAccess);

// ─── Role CRUD (TENANT_ADMIN / PLATFORM_ADMIN) ───────────────────

router.get(
  "/roles",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  iamController.listRoles
);

router.get(
  "/roles/:id",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  iamController.getRole
);

router.post(
  "/roles",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  validate(createCustomRoleSchema),
  iamController.createRole
);

router.patch(
  "/roles/:id",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  validate(updateCustomRoleSchema),
  iamController.updateRole
);

router.delete(
  "/roles/:id",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  iamController.deleteRole
);

// ─── Role Assignment ─────────────────────────────────────────────

router.post(
  "/roles/assign",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  validate(assignCustomRoleSchema),
  iamController.assignRole
);

// ─── Permissions ─────────────────────────────────────────────────

router.get(
  "/permissions",
  requireRole("TENANT_ADMIN", "PLATFORM_ADMIN"),
  iamController.listPermissions
);

router.get(
  "/permissions/mine",
  iamController.getMyPermissions
);

export default router;
