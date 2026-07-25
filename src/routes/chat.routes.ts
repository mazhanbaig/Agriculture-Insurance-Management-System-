import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as chatController from "../controllers/chat.controller";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.get("/conversations", requireRole("FARMER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), chatController.listConversations);
router.post("/conversations/:claimId", requireRole("FARMER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), chatController.getOrCreateConversation);
router.get("/conversations/:conversationId/messages", requireRole("FARMER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), chatController.getMessages);
router.post("/conversations/:conversationId/messages", requireRole("FARMER", "CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), chatController.sendMessage);

export default router;
