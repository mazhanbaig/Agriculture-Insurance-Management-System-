import { Request, Response, NextFunction } from "express";
import * as tenantSettingsService from "../services/tenantSettings.service";

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await tenantSettingsService.getSettings(req.user!.tenantId);
    res.json({ status: "success", data: settings });
  } catch (error) { next(error); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await tenantSettingsService.updateSettings(req.user!.tenantId, req.body);
    res.json({ status: "success", data: settings });
  } catch (error) { next(error); }
}
