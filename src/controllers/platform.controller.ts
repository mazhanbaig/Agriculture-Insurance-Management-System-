import { Request, Response, NextFunction } from "express";
import * as platformService from "../services/platform.service";

export async function createTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await platformService.createTenant(req.body);
    res.status(201).json({ status: "success", data: result });
  } catch (error) { next(error); }
}/**
 * Public signup — no auth required.
 */
export async function signupTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await platformService.signupTenant(req.body);
    res.status(201).json({
      status: "success",
      data: result,
      message: "Tenant created and pending approval. You will be notified once approved.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve a pending tenant (PLATFORM_ADMIN only).
 */
export async function approveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformService.approveTenant(String(req.params.id));
    res.json({ status: "success", data: tenant, message: "Tenant approved" });
  } catch (error) { next(error); }
}

/**
 * Suspend a tenant (PLATFORM_ADMIN only).
 */
export async function suspendTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformService.suspendTenant(String(req.params.id));
    res.json({ status: "success", data: tenant, message: "Tenant suspended" });
  } catch (error) { next(error); }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const status = req.query.status as string | undefined;
    const result = await platformService.listTenants(page, limit, status);
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
