import { Request, Response, NextFunction } from "express";
import * as platformService from "../services/platform.service";

export async function createTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await platformService.createTenant(req.body);
    res.status(201).json({ status: "success", data: result });
  } catch (error) { next(error); }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const result = await platformService.listTenants(page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformService.getTenant(String(req.params.id));
    res.json({ status: "success", data: tenant });
  } catch (error) { next(error); }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformService.updateTenant(String(req.params.id), req.body);
    res.json({ status: "success", data: tenant });
  } catch (error) { next(error); }
}

export async function deactivateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformService.deactivateTenant(String(req.params.id));
    res.json({ status: "success", data: tenant });
  } catch (error) { next(error); }
}

export async function seedTenantPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await platformService.seedTenantPlans(String(req.params.id), req.body.plans);
    res.status(201).json({ status: "success", data: plans });
  } catch (error) { next(error); }
}
