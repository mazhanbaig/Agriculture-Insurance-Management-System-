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
      farmerData,
      customData
    );
    res.json({ status: "success", data: farmer });
  } catch (error) {
    next(error);
  }
}
