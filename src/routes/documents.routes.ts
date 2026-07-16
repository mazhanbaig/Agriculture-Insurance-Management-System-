import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import { uploadLimiter } from "../middleware/rateLimiter";
import * as documentController from "../controllers/documents.controller";

const upload = multer({ dest: "/tmp/uploads/" });

const router = Router();
router.use(requireAuth);

router.post("/upload", requireRole("FARMER", "FIELD_AGENT", "CLAIMS_OFFICER", "ADMIN"), uploadLimiter, upload.single("file"), documentController.uploadDocument);
router.get("/claim/:claimId", requireRole("FARMER", "CLAIMS_OFFICER", "ADMIN"), documentController.getClaimDocuments);
router.get("/:id", requireRole("FARMER", "CLAIMS_OFFICER", "ADMIN"), documentController.getDocument);
router.delete("/:id", requireRole("CLAIMS_OFFICER", "ADMIN"), documentController.deleteDocument);
export default router;
