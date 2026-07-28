import { Request, Response, NextFunction } from "express";
import * as farmerService from "../services/farmers.service";
import * as tenantFieldsService from "../services/tenantFields.service";

export async function getFieldSchema(req: Request, res: Response, next: NextFunction) {
  try {
    const fields = await tenantFieldsService.listTenantFields(req.user!.tenantId);
    res.json({ status: "success", data: fields });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await farmerService.getFarmerProfile(req.user!.id);
    if (!farmer) {
      res.json({ status: "success", data: null });
      return;
    }
    // Attach custom field values if any
    const fieldValues = await tenantFieldsService.getFarmerFieldValues(farmer.id);
    res.json({ status: "success", data: { ...farmer, customData: fieldValues } });
  } catch (error) {
    next(error);
  }
}

export async function createProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { customData, ...farmerData } = req.body;
    const farmer = await farmerService.createFarmerProfile(
      req.user!.id,
      req.user!.tenantId,
      farmerData,
      customData
    );
    res.status(201).json({ status: "success", data: farmer });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { customData, ...farmerData } = req.body;
    const farmer = await farmerService.updateFarmerProfile(
      req.user!.id,
      req.user!.tenantId,
      farmerData,
      customData
    );
    res.json({ status: "success", data: farmer });
  } catch (error) {
    next(error);
  }
}

/**
 * List all farmers (admin only).
 */
export async function listFarmers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const farmers = await farmerService.listFarmers(req.user!.tenantId, page, limit);
    res.json({ status: "success", ...farmers });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single farmer by ID (admin only).
 */
export async function getFarmer(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await farmerService.getFarmerById(String(req.params.id), req.user!.tenantId);
    res.json({ status: "success", data: farmer });
  } catch (error) {
    next(error);
  }
}
