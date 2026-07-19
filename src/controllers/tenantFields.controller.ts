import { Request, Response, NextFunction } from "express";
import * as tenantFieldsService from "../services/tenantFields.service";

export async function listFields(req: Request, res: Response, next: NextFunction) {
  try {
    const fields = await tenantFieldsService.listTenantFields(req.user!.tenantId);
    res.json({ status: "success", data: fields });
  } catch (error) {
    next(error);
  }
}

export async function getField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await tenantFieldsService.getTenantField(req.user!.tenantId, req.params.id as string);
    res.json({ status: "success", data: field });
  } catch (error) {
    next(error);
  }
}

export async function createField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await tenantFieldsService.createTenantField(
      req.user!.tenantId,
      req.body
    );
    res.status(201).json({ status: "success", data: field });
  } catch (error) {
    next(error);
  }
}

export async function updateField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await tenantFieldsService.updateTenantField(
      req.user!.tenantId,
      req.params.id as string,
      req.body
    );
    res.json({ status: "success", data: field });
  } catch (error) {
    next(error);
  }
}

export async function deleteField(req: Request, res: Response, next: NextFunction) {
  try {
    const field = await tenantFieldsService.deleteTenantField(
      req.user!.tenantId,
      req.params.id as string
    );
    res.json({ status: "success", data: field });
  } catch (error) {
    next(error);
  }
}
