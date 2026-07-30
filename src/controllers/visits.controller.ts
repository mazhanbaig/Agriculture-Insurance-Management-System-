import { Request, Response, NextFunction } from "express";
import * as visitService from "../services/visit.service";

export async function scheduleVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const claimId = req.params.claimId as string;
    const tenantId = req.user!.tenantId;
    const { assignedToId, scheduledDate, notes } = req.body;
    const visit = await visitService.scheduleVisit(claimId, tenantId, assignedToId, new Date(scheduledDate), notes);
    res.json({ status: "success", data: visit });
  } catch (error) { next(error); }
}

export async function completeVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const visitId = req.params.visitId as string;
    const { locationLat, locationLng, locationAddress, notes, reportUrl, damagePercent } = req.body;
    const visit = await visitService.completeVisit(visitId, { locationLat, locationLng, locationAddress, notes, reportUrl, damagePercent });
    res.json({ status: "success", data: visit });
  } catch (error) { next(error); }
}

export async function listVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const claimId = req.query.claimId as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await visitService.listVisits(tenantId, claimId, status, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function cancelVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const visitId = req.params.visitId as string;
    const visit = await visitService.cancelVisit(visitId);
    res.json({ status: "success", data: visit });
  } catch (error) { next(error); }
}
