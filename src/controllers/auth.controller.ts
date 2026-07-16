import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try { const user = await authService.getCurrentUser(req.user!.id); res.json({ status: "success", data: user }); }
  catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try { const user = await authService.updateProfile(req.user!.id, req.body); res.json({ status: "success", data: user }); }
  catch (error) { next(error); }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try { const { userId, role } = req.body; const updated = await authService.updateUserRole(req.user!.id, userId, role); res.json({ status: "success", data: updated }); }
  catch (error) { next(error); }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try { const page = parseInt(String(req.query.page ?? "1"), 10); const limit = parseInt(String(req.query.limit ?? "20"), 10); const result = await authService.listUsers(page, limit); res.json({ status: "success", ...result }); }
  catch (error) { next(error); }
}
