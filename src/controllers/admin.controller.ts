import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/admin.service";

export async function createStaffUser(req: Request, res: Response, next: NextFunction) {
  try { const user = await adminService.createStaffUser(req.body); res.status(201).json({ status: "success", data: user }); }
  catch (error) { next(error); }
}

export async function listStaffUsers(req: Request, res: Response, next: NextFunction) {
  try { const page = parseInt(String(req.query.page ?? "1"), 10); const limit = parseInt(String(req.query.limit ?? "20"), 10); const role = String(req.query.role ?? "") || undefined; const result = await adminService.listStaffUsers(page, limit, role); res.json({ status: "success", ...result }); }
  catch (error) { next(error); }
}

export async function toggleUserStatus(req: Request, res: Response, next: NextFunction) {
  try { const user = await adminService.toggleUserStatus(String(req.params.id)); res.json({ status: "success", data: user }); }
  catch (error) { next(error); }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try { const dashboard = await adminService.getDashboardAggregates(); res.json({ status: "success", data: dashboard }); }
  catch (error) { next(error); }
}

export async function getClaimsAnalytics(req: Request, res: Response, next: NextFunction) {
  try { const analytics = await adminService.getClaimsAnalytics(); res.json({ status: "success", data: analytics }); }
  catch (error) { next(error); }
}
