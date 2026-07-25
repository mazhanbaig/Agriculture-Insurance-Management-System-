import { Request, Response, NextFunction } from "express";
import * as damageService from "../services/damage.service";

export async function calculateDamage(req: Request, res: Response, next: NextFunction) {
  try {
    const claimId = req.params.claimId as string;
    const tenantId = req.user!.tenantId;
    const { ndviDamagePercent, weatherConfirmed, aiDamageScore, groundTruthDamagePercent } = req.body;
    const result = await damageService.calculateDamageAndPayout({
      claimId, tenantId, ndviDamagePercent, weatherConfirmed, aiDamageScore, groundTruthDamagePercent,
    });
    res.json({ status: "success", data: result });
  } catch (error) { next(error); }
}

export async function getDamageAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const claimId = req.params.claimId as string;
    const tenantId = req.user!.tenantId;
    const assessment = await damageService.getDamageAssessment(claimId, tenantId);
    if (!assessment) return res.status(404).json({ status: "error", message: "No assessment found" });
    res.json({ status: "success", data: assessment });
  } catch (error) { next(error); }
}
