import { Router } from "express";
import { handleWebhook } from "../controllers/billingWebhook.controller";
import { handleGatewayWebhook } from "../controllers/webhook.controller";

const router = Router();

// All webhook routes receive raw body from server.ts
router.post("/stripe", handleWebhook);
router.post("/easypaisa", handleGatewayWebhook);
router.post("/jazzcash", handleGatewayWebhook);

export default router;
