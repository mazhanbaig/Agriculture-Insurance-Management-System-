import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farmer: true },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
}

export async function updateProfile(userId: string, data: { phone?: string }) {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function updateUserRole(
  currentUserId: string,
  targetUserId: string,
  role: string
) {
  const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new AppError("Only admins can change user roles", 403);
  }
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new AppError("User not found", 404);
  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: role as any },
  });
}

export async function listUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count(),
  ]);
  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
