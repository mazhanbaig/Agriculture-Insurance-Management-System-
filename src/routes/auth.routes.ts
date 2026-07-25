import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { updateProfileSchema, updateUserRoleSchema, registerSchema, loginSchema, forgotPasswordSchema, oauthCallbackSchema, oauthSetupSchema } from "../validators/auth.validator";

const router = Router();

// Public routes (no auth required)
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/oauth/callback", validate(oauthCallbackSchema), authController.oauthCallback);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);

// Protected routes (auth required)
router.use(requireAuth);
router.get("/me", authController.getMe);
router.patch("/profile", validate(updateProfileSchema), authController.updateProfile);
router.post("/oauth/setup", validate(oauthSetupSchema), authController.completeOAuthSetup);
router.patch("/role", requireRole("PLATFORM_ADMIN"), validate(updateUserRoleSchema), authController.updateUserRole);
router.get("/users", requireRole("PLATFORM_ADMIN"), authController.listUsers);
export default router;
