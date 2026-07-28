import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger";

let io: Server | null = null;

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

    socket.join(`user:${userId}`);
    socket.join(`tenant:${tenantId}`);

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });

  logger.info("Socket.IO initialized");
  return io;
}

function sendToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function notifyFraudUpdate(claimId: string, userId: string, fraudScore: number, fraudVerdict: string): void {
  sendToUser(userId, "fraud-update", { claimId, fraudScore, fraudVerdict });
}
