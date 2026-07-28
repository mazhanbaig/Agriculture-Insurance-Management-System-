import { Router } from "express";
import { noLimit } from "../middleware/rateLimiter";
import * as devAuthController from "../controllers/dev-auth.controller";

const router = Router();

// No rate limiting on dev routes
router.use(noLimit);

// Dev seed — creates users directly via Prisma (bypasses Supabase)
router.post("/seed", devAuthController.seedUser);

// Dev login — by email only (no password check)
router.post("/login", devAuthController.login);

// List all users with auth source info
router.get("/users", devAuthController.listUsers);

export default router;
