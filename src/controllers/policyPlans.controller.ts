import { Request, Response, NextFunction } from "express";
import * as policyPlanService from "../services/policyPlans.service";

export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try { const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20; const result = await policyPlanService.listPolicyPlans(req.user!.tenantId, page, limit); res.json({ status: "success", ...result }); }
  catch (error) { next(error); }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try { const plan = await policyPlanService.getPolicyPlan(String(req.params.id), req.user!.tenantId); res.json({ status: "success", data: plan }); }
  catch (error) { next(error); }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try { const plan = await policyPlanService.createPolicyPlan(req.user!.tenantId, req.body); res.status(201).json({ status: "success", data: plan }); }
  catch (error) { next(error); }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try { const plan = await policyPlanService.updatePolicyPlan(String(req.params.id), req.user!.tenantId, req.body); res.json({ status: "success", data: plan }); }
  catch (error) { next(error); }
}

export async function calculateQuote(req: Request, res: Response, next: NextFunction) {
  try { const { policyPlanId, areaAcres, termMonths } = req.body; const quote = await policyPlanService.calculateQuote(policyPlanId, req.user!.tenantId, areaAcres, termMonths); res.json({ status: "success", data: quote }); }
  catch (error) { next(error); }
}
