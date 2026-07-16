import { Request, Response, NextFunction } from "express";
import * as farmerService from "../services/farmers.service";

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try { const farmer = await farmerService.getFarmerProfile(req.user!.id); res.json({ status: "success", data: farmer }); }
  catch (error) { next(error); }
}

export async function createProfile(req: Request, res: Response, next: NextFunction) {
  try { const farmer = await farmerService.createFarmerProfile(req.user!.id, req.user!.tenantId, req.body); res.status(201).json({ status: "success", data: farmer }); }
  catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try { const farmer = await farmerService.updateFarmerProfile(req.user!.id, req.body); res.json({ status: "success", data: farmer }); }
  catch (error) { next(error); }
}
