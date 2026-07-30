import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { notificationQueue } from "../lib/bullmq";
import logger from "../utils/logger";

export async function getOrCreateConversation(
  claimId: string,
  tenantId: string,
  title?: string
) {
  let conversation = await prisma.conversation.findFirst({
    where: { claimId, tenantId, isActive: true },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { claimId, tenantId, title: title || `Discussion for claim ${claimId.slice(0, 8)}` },
      include: { messages: true },
    });
  }

  return conversation;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: string = "text",
  metadata?: Record<string, any>
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { claim: { select: { farmerId: true, claimNumber: true, tenantId: true } } },
  });
  if (!conversation) throw new AppError("Conversation not found", 404);

  const message = await prisma.message.create({
    data: { conversationId, senderId, content, type, metadata: metadata || undefined },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const targetUserId = conversation.claim.farmerId;
  await notificationQueue.add("new-message", {
    userId: targetUserId,
    type: "NEW_MESSAGE",
    title: "New Message",
    message: `New message on claim ${conversation.claim.claimNumber}: ${content.slice(0, 100)}`,
    relatedEntityType: "Conversation",
    relatedEntityId: conversationId,
  });

  logger.info({ conversationId, messageId: message.id, senderId }, "Message sent");
  return message;
}

export async function getConversationMessages(
  conversationId: string,
  page: number = 1,
  limit: number = 50
) {
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return { items: messages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listConversations(
  tenantId: string,
  userId: string,
  role: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId, isActive: true };

  if (role === "FARMER") {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (farmer) {
      where.claim = { farmerId: farmer.id };
    }
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        claim: { select: { claimNumber: true, status: true, farmerId: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return { items: conversations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
