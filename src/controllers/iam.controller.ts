import { Request, Response, NextFunction } from "express";
import * as iamService from "../services/iam.service";

// ─── Custom Role CRUD ────────────────────────────────────────────

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await iamService.listCustomRoles(req.user!.tenantId!);
    res.json({ status: "success", data: roles });
  } catch (error) {
    next(error);
  }
}

export async function getRole(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = req.params.id as string;
    const role = await iamService.getCustomRole(roleId, req.user!.tenantId!);
    res.json({ status: "success", data: role });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await iamService.createCustomRole(req.user!.tenantId!, req.body);
    res.status(201).json({ status: "success", data: role });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = req.params.id as string;
    const role = await iamService.updateCustomRole(roleId, req.user!.tenantId!, req.body);
    res.json({ status: "success", data: role });
  } catch (error) {
    next(error);
  }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = req.params.id as string;
    await iamService.deleteCustomRole(roleId, req.user!.tenantId!);
    res.json({ status: "success", message: "Custom role deleted" });
  } catch (error) {
    next(error);
  }
}

// ─── Role Assignment ─────────────────────────────────────────────

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, customRoleId } = req.body;
    const result = await iamService.assignCustomRole(
      userId,
      customRoleId,
      req.user!.tenantId!
    );
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

// ─── Permissions ─────────────────────────────────────────────────

export async function listPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = iamService.getAllPermissions();
    res.json({ status: "success", data: permissions });
  } catch (error) {
    next(error);
  }
}

export async function getMyPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await iamService.resolveUserPermissions(req.user!.id);
    res.json({ status: "success", data: { permissions } });
  } catch (error) {
    next(error);
  }
}
