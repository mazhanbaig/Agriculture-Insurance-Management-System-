import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { updateProfileSchema, updateUserRoleSchema } from "../validators/auth.validator";

const router = Router();
router.use(requireAuth);
router.get("/me", authController.getMe);
router.patch("/profile", validate(updateProfileSchema), authController.updateProfile);
router.patch("/role", requireRole("PLATFORM_ADMIN"), validate(updateUserRoleSchema), authController.updateUserRole);
router.get("/users", requireRole("PLATFORM_ADMIN"), authController.listUsers);
export default router;
