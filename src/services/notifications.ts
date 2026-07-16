import { prisma } from "../lib/prisma";

export async function listNotifications(userId: string, page: number, limit: number, unreadOnly?: boolean) {
  const skip = (page - 1) * limit;
  const where: any = { userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function markAsRead(userId: string, notificationIds: string[]) {
  await prisma.notification.updateMany({ where: { id: { in: notificationIds }, userId }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
