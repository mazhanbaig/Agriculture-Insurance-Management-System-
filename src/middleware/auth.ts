import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        authId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Auth guard middleware.
 * Verifies the Bearer token against Neon Auth via Stack Auth SDK,
 * then looks up or creates the local User row.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Missing or invalid authorization header", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AppError("Missing token", 401);
    }

    // Verify session with Stack Auth
    const { StackServerApp } = await import("@stackframe/stack");
    const stackApp = new StackServerApp({
      tokenStore: "cookie",
      publishableClientKey: process.env.STACK_PUBLISHABLE_KEY!,
      secretServerKey: process.env.STACK_SECRET_KEY!,
    });

    // Type assertion for Stack Auth API compatibility
    const session = await (stackApp as any).getSession({ token });
    if (!session) {
      throw new AppError("Invalid or expired session", 401);
    }

    const user = await (session as any).getUser();
    if (!user) {
      throw new AppError("User not found in auth provider", 401);
    }

    const authId = (user as any).id;
    const email = (user as any).primaryEmail || "";

    // Upsert local user row
    let localUser = await prisma.user.findUnique({ where: { authId } });

    if (!localUser) {
      // First login — create local user with FARMER role by default
      localUser = await prisma.user.create({
        data: {
          authId,
          email,
          role: "FARMER",
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update last login and email on subsequent logins
      localUser = await prisma.user.update({
        where: { id: localUser.id },
        data: {
          lastLoginAt: new Date(),
          email,
        },
      });
    }

    req.user = {
      id: localUser.id,
      authId: localUser.authId,
      email: localUser.email,
      role: localUser.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError("Authentication failed", 401));
    }
  }
}
