import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger";

let io: Server | null = null;

const userSockets = new Map<string, Set<string>>();

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173"],
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId as string;
    const tenantId = socket.handshake.auth.tenantId as string;
    if (!userId || !tenantId) {
      return next(new Error("Authentication required"));
    }
    (socket as any).userId = userId;
    (socket as any).tenantId = tenantId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    const tenantId = (socket as any).tenantId;

    logger.info({ userId, tenantId, socketId: socket.id }, "Socket connected");

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socket.join(`user:${userId}`);
    socket.join(`tenant:${tenantId}`);

    socket.on("join:claim", (claimId: string) => {
      socket.join(`claim:${claimId}`);
    });

    socket.on("leave:claim", (claimId: string) => {
      socket.leave(`claim:${claimId}`);
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
      logger.info({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });

  logger.info("Socket.IO initialized");
  return io;
}

export function sendToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function sendToClaim(claimId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`claim:${claimId}`).emit(event, data);
}

export function sendToTenant(tenantId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, data);
}

export function notifyNewMessage(conversationId: string, userId: string, message: any): void {
  sendToUser(userId, "new-message", { conversationId, message });
}

export function notifyClaimUpdate(claimId: string, update: any): void {
  sendToClaim(claimId, "claim-update", update);
}

export function notifyFraudUpdate(claimId: string, userId: string, fraudScore: number, fraudVerdict: string): void {
  sendToUser(userId, "fraud-update", { claimId, fraudScore, fraudVerdict });
}

export function notifyVisitUpdate(visitId: string, claimId: string, status: string): void {
  sendToClaim(claimId, "visit-update", { visitId, status });
}
