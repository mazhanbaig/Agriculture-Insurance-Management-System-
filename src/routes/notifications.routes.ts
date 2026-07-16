import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as notificationController from "../controllers/notifications.controller";
import { validate } from "../middleware/validate";
import { markReadSchema } from "../validators/notifications.validator";

const router = Router();
router.use(requireAuth);
router.get("/", notificationController.listNotifications);
router.patch("/read", validate(markReadSchema), notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);
export default router;
