import { Request, Response, NextFunction } from "express";
import * as chatService from "../services/chat.service";
import { getIO } from "../lib/socket";

export async function getOrCreateConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const claimId = req.params.claimId as string;
    const tenantId = req.user!.tenantId;
    const { title } = req.body;
    const conversation = await chatService.getOrCreateConversation(claimId, tenantId, title);
    res.json({ status: "success", data: conversation });
  } catch (error) { next(error); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationId = req.params.conversationId as string;
    const senderId = req.user!.id;
    const { content, type, metadata } = req.body;
    const message = await chatService.sendMessage(conversationId, senderId, content, type, metadata);

    const io = getIO();
    io.to(`conversation:${conversationId}`).emit("new-message", message);

    res.json({ status: "success", data: message });
  } catch (error) { next(error); }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationId = req.params.conversationId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await chatService.getConversationMessages(conversationId, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await chatService.listConversations(tenantId, userId, role, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}
