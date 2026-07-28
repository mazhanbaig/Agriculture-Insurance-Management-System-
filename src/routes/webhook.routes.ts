import { Router } from "express";
import { handleGatewayWebhook } from "../controllers/webhook.controller";

const router = Router();

// All webhook routes receive raw body from server.ts
router.post("/easypaisa", handleGatewayWebhook);
router.post("/jazzcash", handleGatewayWebhook);

export default router;
