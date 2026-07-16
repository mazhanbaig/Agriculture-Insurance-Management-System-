import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import * as claimService from "../services/claims.service";

export async function createClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile required" }); return; }
    const claim = await claimService.createClaim(farmer.id, req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ status: "success", data: claim });
  } catch (error) { next(error); }
}

export async function listMyClaims(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20;
    const status = String(req.query.status ?? "") || undefined;
    const result = await claimService.listFarmerClaims(farmer.id, req.user!.tenantId, page, limit, status);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function getClaim(req: Request, res: Response, next: NextFunction) {
  try { const claim = await claimService.getClaim(String(req.params.id), req.user!.tenantId); res.json({ status: "success", data: claim }); }
  catch (error) { next(error); }
}

export async function assignClaim(req: Request, res: Response, next: NextFunction) {
  try { const { claimsOfficerId } = req.body; const claim = await claimService.assignClaim(String(req.params.id), req.user!.tenantId, claimsOfficerId); res.json({ status: "success", data: claim }); }
  catch (error) { next(error); }
}

export async function updateClaimStatus(req: Request, res: Response, next: NextFunction) {
  try { const claim = await claimService.updateClaimStatus(String(req.params.id), req.user!.tenantId, req.user!.id, req.body); res.json({ status: "success", data: claim }); }
  catch (error) { next(error); }
}

export async function listAllClaims(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20;
    const status = String(req.query.status ?? "") || undefined;
    const result = await claimService.listAllClaims(req.user!.tenantId, page, limit, status);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}
