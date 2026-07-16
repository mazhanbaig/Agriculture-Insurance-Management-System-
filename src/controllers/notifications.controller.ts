import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notifications.service";

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try { const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20; const unreadOnly = req.query.unreadOnly === "true"; const result = await notificationService.listNotifications(req.user!.id, page, limit, unreadOnly); res.json({ status: "success", ...result }); }
  catch (error) { next(error); }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try { await notificationService.markAsRead(req.user!.id, req.body.notificationIds); res.json({ status: "success", message: "Notifications marked as read" }); }
  catch (error) { next(error); }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try { await notificationService.markAllAsRead(req.user!.id); res.json({ status: "success", message: "All notifications marked as read" }); }
  catch (error) { next(error); }
}
