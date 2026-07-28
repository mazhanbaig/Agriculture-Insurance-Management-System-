import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import * as tenantFieldsService from "./tenantFields.service";

export async function getFarmerProfile(userId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    include: { landParcels: true, policies: true, claims: true },
  });
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

/**
 * List all farmers for a tenant (admin function).
 */
export async function listFarmers(tenantId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [farmers, total] = await Promise.all([
    prisma.farmer.findMany({
      where: { tenantId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, phone: true, isActive: true } },
        landParcels: { select: { id: true, landTitleNumber: true, areaAcres: true, address: true, cropType: true } },
      },
    }),
    prisma.farmer.count({ where: { tenantId } }),
  ]);
  return { data: farmers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Get a farmer by ID (admin function).
 */
export async function getFarmerById(farmerId: string, tenantId: string) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, tenantId },
    include: {
      user: { select: { email: true, phone: true, isActive: true, createdAt: true } },
      landParcels: true,
      policies: true,
      claims: true,
    },
  });
  if (!farmer) throw new AppError("Farmer not found", 404);
  return farmer;
}

export async function updateFarmerProfile(
  userId: string,
  tenantId: string,
  data: Record<string, any>,
  customData?: Record<string, any>
) {
  if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
  // Map frontend field names to DB field names
  if (data.name && !data.fullName) data.fullName = data.name;
  if (data.state && !data.province) data.province = data.state;
  delete data.name;
  delete data.state;
  delete data.phone; // phone lives on User model, not Farmer

  const existing = await prisma.farmer.findUnique({ where: { userId } });

  if (!existing) {
    // Auto-create farmer profile if it doesn't exist
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    const farmer = await prisma.farmer.create({
      data: {
        userId,
        tenantId,
        fullName: data.fullName || user.email?.split("@")[0] || "Unknown",
        cnicNumber: data.cnicNumber || `TEMP-${userId.slice(0, 8)}`,
        ...data,
      },
    });

    if (customData) {
      const validatedCustomData = await tenantFieldsService.validateCustomData(tenantId, customData);
      if (validatedCustomData) {
        await tenantFieldsService.saveFarmerFieldValues(farmer.id, validatedCustomData);
      }
    }

    return farmer;
  }

  const result = await prisma.farmer.update({ where: { userId }, data });

  // Update custom field values if provided
  if (customData) {
    const validatedCustomData = await tenantFieldsService.validateCustomData(
      existing.tenantId,
      customData
    );
    if (validatedCustomData) {
      await tenantFieldsService.saveFarmerFieldValues(existing.id, validatedCustomData);
    }
  }

  return result;
}
