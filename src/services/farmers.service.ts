import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import * as tenantFieldsService from "./tenantFields.service";

export async function getFarmerProfile(userId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    include: { landParcels: true, policies: true, claims: true },
  });
  if (!farmer) throw new AppError("Farmer profile not found. Create one first.", 404);
  return farmer;
}

export async function createFarmerProfile(
  userId: string,
  tenantId: string,
  data: {
    fullName: string; guardianName?: string; cnicNumber: string;
    dateOfBirth?: string; gender?: string; address?: string;
    city?: string; province?: string; bankName?: string;
    bankAccountNumber?: string; accountTitle?: string; profilePhotoUrl?: string;
  },
  customData?: Record<string, any>
) {
  const existing = await prisma.farmer.findUnique({ where: { userId } });
  if (existing) throw new AppError("Farmer profile already exists", 409);
  const cnicExists = await prisma.farmer.findFirst({
    where: { cnicNumber: data.cnicNumber, tenantId },
  });
  if (cnicExists) throw new AppError("CNIC number is already registered in this tenant", 409);

  // Validate required custom fields (if tenant has configured them)
  await tenantFieldsService.assertRequiredCustomFields(tenantId, customData);

  // Validate custom data against tenant field schema
  const validatedCustomData = await tenantFieldsService.validateCustomData(tenantId, customData);

  const farmer = await prisma.farmer.create({
    data: {
      userId,
      tenantId,
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    },
  });

  // Save custom field values
  if (validatedCustomData) {
    await tenantFieldsService.saveFarmerFieldValues(farmer.id, validatedCustomData);
  }

  return farmer;
}

export async function updateFarmerProfile(
  userId: string,
  data: Record<string, any>,
  customData?: Record<string, any>
) {
  const farmer = await prisma.farmer.findUnique({ where: { userId } });
  if (!farmer) throw new AppError("Farmer profile not found", 404);
  if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

  const result = await prisma.farmer.update({ where: { userId }, data });

  // Update custom field values if provided
  if (customData) {
    const validatedCustomData = await tenantFieldsService.validateCustomData(
      farmer.tenantId,
      customData
    );
    if (validatedCustomData) {
      await tenantFieldsService.saveFarmerFieldValues(farmer.id, validatedCustomData);
    }
  }

  return result;
}
