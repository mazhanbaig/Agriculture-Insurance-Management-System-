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

export async function createFarmerProfile(
  userId: string,
  data: {
    fullName: string; guardianName?: string; cnicNumber: string;
    dateOfBirth?: string; gender?: string; address?: string;
    city?: string; province?: string; bankName?: string;
    bankAccountNumber?: string; accountTitle?: string; profilePhotoUrl?: string;
  }
) {
  const existing = await prisma.farmer.findUnique({ where: { userId } });
  if (existing) throw new AppError("Farmer profile already exists", 409);
  const cnicExists = await prisma.farmer.findUnique({ where: { cnicNumber: data.cnicNumber } });
  if (cnicExists) throw new AppError("CNIC number is already registered", 409);

  return prisma.farmer.create({
    data: { userId, ...data, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined },
  });
}

export async function updateFarmerProfile(userId: string, data: Record<string, any>) {
  const farmer = await prisma.farmer.findUnique({ where: { userId } });
  if (!farmer) throw new AppError("Farmer profile not found", 404);
  if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
  return prisma.farmer.update({ where: { userId }, data });
}
