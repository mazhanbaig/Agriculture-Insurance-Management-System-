import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import * as landParcelService from "../services/landParcels.service";

export async function getParcels(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const page = parseInt(String(req.query.page ?? "1")) || 1; const limit = parseInt(String(req.query.limit ?? "20")) || 20;
    const result = await landParcelService.getLandParcels(farmer.id, req.user!.tenantId, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function getParcel(req: Request, res: Response, next: NextFunction) {
  try { const parcel = await landParcelService.getLandParcel(String(req.params.id), req.user!.tenantId); res.json({ status: "success", data: parcel }); }
  catch (error) { next(error); }
}

export async function createParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const parcel = await landParcelService.createLandParcel(farmer.id, req.user!.tenantId, req.body);
    res.status(201).json({ status: "success", data: parcel });
  } catch (error) { next(error); }
}

export async function updateParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    const parcel = await landParcelService.updateLandParcel(String(req.params.id), farmer.id, req.user!.tenantId, req.body);
    res.json({ status: "success", data: parcel });
  } catch (error) { next(error); }
}

export async function deleteParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) { res.status(400).json({ status: "error", message: "Farmer profile not found" }); return; }
    await landParcelService.deleteLandParcel(String(req.params.id), farmer.id, req.user!.tenantId);
    res.json({ status: "success", message: "Land parcel deleted" });
  } catch (error) { next(error); }
}
