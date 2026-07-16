import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import * as policyService from "../services/policies.service";

export async function purchasePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const policy = await policyService.purchasePolicy(farmer.id, req.body);
    res.status(201).json({ status: "success", data: policy });
  } catch (error) { next(error); }
}

export async function listMyPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20;
    const result = await policyService.listFarmerPolicies(farmer.id, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function getPolicy(req: Request, res: Response, next: NextFunction) {
  try { const policy = await policyService.getPolicy(String(req.params.id)); res.json({ status: "success", data: policy }); }
  catch (error) { next(error); }
}
