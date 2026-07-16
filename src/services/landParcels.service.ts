import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export async function getLandParcels(farmerId: string, tenantId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [parcels, total] = await Promise.all([
    prisma.landParcel.findMany({ where: { farmerId, tenantId }, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.landParcel.count({ where: { farmerId, tenantId } }),
  ]);
  return { parcels, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getLandParcel(parcelId: string, tenantId: string) {
  const parcel = await prisma.landParcel.findFirst({ where: { id: parcelId, tenantId }, include: { policies: true } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  return parcel;
}

export async function createLandParcel(farmerId: string, tenantId: string, data: {
  landTitleNumber?: string; address: string; latitude?: number; longitude?: number;
  areaAcres: number; soilType?: string; cropType: string;
  irrigationType?: string; ownershipType?: string; district?: string;
}) {
  return prisma.landParcel.create({ data: { farmerId, tenantId, ...data } });
}

export async function updateLandParcel(parcelId: string, farmerId: string, tenantId: string, data: Record<string, any>) {
  const parcel = await prisma.landParcel.findFirst({ where: { id: parcelId, tenantId } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Access denied. This parcel does not belong to you.", 403);
  return prisma.landParcel.update({ where: { id: parcelId }, data });
}

export async function deleteLandParcel(parcelId: string, farmerId: string, tenantId: string) {
  const parcel = await prisma.landParcel.findFirst({ where: { id: parcelId, tenantId } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Access denied. This parcel does not belong to you.", 403);
  await prisma.landParcel.delete({ where: { id: parcelId } });
}
