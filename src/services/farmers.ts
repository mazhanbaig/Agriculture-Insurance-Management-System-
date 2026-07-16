import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export async function getFarmerProfile(userId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    include: { landParcels: true, policies: true, claims: true },
  });
  if (!farmer) throw new AppError("Farmer profile not found. Create one first.", 404);
  return farmer;
}

export async function createFarmerProfile(userId: string, data: any) {
  const existing = await prisma.farmer.findUnique({ where: { userId } });
  if (existing) throw new AppError("Farmer profile already exists", 409);
  const cnicExists = await prisma.farmer.findUnique({ where: { cnicNumber: data.cnicNumber } });
  if (cnicExists) throw new AppError("CNIC number is already registered", 409);
  return prisma.farmer.create({
    data: { userId, ...data, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined },
  });
}

export async function updateFarmerProfile(userId: string, data: any) {
  const farmer = await prisma.farmer.findUnique({ where: { userId } });
  if (!farmer) throw new AppError("Farmer profile not found", 404);
  const updateData = { ...data };
  if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
  return prisma.farmer.update({ where: { userId }, data: updateData });
}

export async function getLandParcels(farmerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [parcels, total] = await Promise.all([
    prisma.landParcel.findMany({ where: { farmerId }, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.landParcel.count({ where: { farmerId } }),
  ]);
  return { parcels, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getLandParcel(parcelId: string) {
  const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId }, include: { policies: true } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  return parcel;
}

export async function createLandParcel(farmerId: string, data: any) {
  return prisma.landParcel.create({ data: { farmerId, ...data } });
}

export async function updateLandParcel(parcelId: string, farmerId: string, data: any) {
  const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Access denied. This parcel does not belong to you.", 403);
  return prisma.landParcel.update({ where: { id: parcelId }, data });
}

export async function deleteLandParcel(parcelId: string, farmerId: string) {
  const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw new AppError("Land parcel not found", 404);
  if (parcel.farmerId !== farmerId) throw new AppError("Access denied. This parcel does not belong to you.", 403);
  await prisma.landParcel.delete({ where: { id: parcelId } });
}
