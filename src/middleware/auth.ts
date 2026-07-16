import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

// Extend Express Request to include user and tenant
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        authId: string;
        email: string;
        role: string;
      };
      tenant?: {
        id: string;
        name: string;
        slug: string;
        config: Record<string, any> | null;
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

    // Resolve tenant from header (priority) or hostname
    let tenantId: string | null = null;
    const tenantHeader = req.headers["x-tenant-id"] as string | undefined;

    if (tenantHeader) {
      tenantId = tenantHeader;
    }

    // Upsert local user row
    let localUser = await prisma.user.findUnique({ where: { authId } });

    if (!localUser) {
      // If tenantId wasn't resolved from header, try to find or use default
      if (!tenantId) {
        const defaultTenant = await prisma.tenant.findUnique({
          where: { slug: "default" },
        });
        if (!defaultTenant) {
          throw new AppError("No tenant configured. Contact platform admin.", 400);
        }
        tenantId = defaultTenant.id;
      }

      // First login — create local user with FARMER role by default
      localUser = await prisma.user.create({
        data: {
          tenantId,
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

    // If tenant was resolved from header, verify the user belongs to that tenant
    if (tenantId && localUser.tenantId !== tenantId) {
      throw new AppError("User does not belong to the specified tenant", 403);
    }

    req.user = {
      id: localUser.id,
      tenantId: localUser.tenantId,
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

/**
 * Resolve tenant from subdomain or header and attach to request.
 * Used for subdomain-based multi-tenant routing.
 */
export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // If tenant is already on the request, skip resolution
    if (req.tenant) {
      next();
      return;
    }

    const host = req.hostname || "";
    const parts = host.split(".");

    // Check for x-tenant-slug header first (useful for API clients)
    const slugHeader = req.headers["x-tenant-slug"] as string | undefined;
    let slug: string | undefined;

    if (slugHeader) {
      slug = slugHeader;
    } else if (parts.length >= 2) {
      // Extract subdomain: e.g., "tenantname" from "tenantname.aims.com"
      const subdomain = parts[0];
      if (subdomain && subdomain !== "www" && subdomain !== "api") {
        slug = subdomain;
      }
    }

    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant && tenant.isActive) {
        req.tenant = {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          config: tenant.config as Record<string, any> | null,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without tenant attached if resolution fails
    next();
  }
}
