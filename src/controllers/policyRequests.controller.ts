import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import * as policyRequestService from "../services/policyRequests.service";

export async function createPolicyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user!.id } });
    if (!farmer) {
      res.status(400).json({ status: "error", message: "Farmer profile not found" });
      return;
    }
    const request = await policyRequestService.createPolicyRequest(
      farmer.id,
      req.user!.tenantId,
      req.body
    );
    res.status(201).json({
      status: "success",
      data: request,
      message: "Purchase request submitted. You will be contacted when it is reviewed.",
    });
  } catch (error) {
    next(error);
  }
}

export async function listPolicyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1")) || 1;
    const limit = parseInt(String(req.query.limit ?? "20")) || 20;
    const status = req.query.status as string | undefined;
    const result = await policyRequestService.listPolicyRequests(
      req.user!.id,
      req.user!.role,
      req.user!.tenantId,
      page,
      limit,
      status
    );
    res.json({ status: "success", ...result });
  } catch (error) {
    next(error);
  }
}

export async function getPolicyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await policyRequestService.getPolicyRequest(
      String(req.params.id),
      req.user!.tenantId
    );
    res.json({ status: "success", data: request });
  } catch (error) {
    next(error);
  }
}

export async function reviewPolicyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await policyRequestService.reviewPolicyRequest(
      String(req.params.id),
      req.user!.tenantId,
      req.user!.id,
      req.body
    );
    res.json({ status: "success", data: request, message: `Request ${req.body.status.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
}

export async function convertPolicyRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const policy = await policyRequestService.convertPolicyRequest(
      String(req.params.id),
      req.user!.tenantId,
      req.user!.id
    );
    res.status(201).json({
      status: "success",
      data: policy,
      message: "Policy request converted to active policy",
    });
  } catch (error) {
    next(error);
  }
}
