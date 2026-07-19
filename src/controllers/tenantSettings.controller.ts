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

export async function getFraudTier(req: Request, res: Response, next: NextFunction) {
  try {
    const fraudTierInfo = await tenantSettingsService.getFraudTierSettings(req.user!.tenantId);
    res.json({ status: "success", data: fraudTierInfo });
  } catch (error) { next(error); }
}

export async function updateFraudTier(req: Request, res: Response, next: NextFunction) {
  try {
    const fraudTierInfo = await tenantSettingsService.updateFraudTier(req.user!.tenantId, req.body.tier);
    res.json({ status: "success", data: fraudTierInfo });
  } catch (error) { next(error); }
}
