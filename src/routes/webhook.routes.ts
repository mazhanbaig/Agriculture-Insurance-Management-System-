import { Router } from "express";
import { handleWebhook } from "../controllers/billingWebhook.controller";

const router = Router();

// Stripe webhook needs raw body — server.ts handles raw body parsing for this route
router.post("/stripe", handleWebhook);

export default router;
