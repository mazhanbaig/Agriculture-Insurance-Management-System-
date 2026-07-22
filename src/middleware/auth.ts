import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

// Extend Express Request type globally (used by all controllers)
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
      requestId?: string;
    }
  }
}

/**
 * Auth guard middleware.
 * Verifies the Bearer JWT token against Supabase Auth,
 * then looks up or creates the local User row.
 *
 * Lookup strategy:
 * 1. First tries to find user by `authId` (Supabase user UUID).
 * 2. If not found, tries to find by email (handles admin-created users
 *    who had placeholder authIds before their Supabase sign-up).
 * 3. If found by email, updates authId to the real Supabase UUID.
 * 4. If not found at all, creates a new local user record.
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

    // Verify token with Supabase Auth
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new AppError("Invalid or expired token", 401);
    }

    const authId = supabaseUser.id;
    const email = supabaseUser.email || "";

    // Resolve tenant from header (priority)
    const tenantHeader = req.headers["x-tenant-id"] as string | undefined;
    let tenantId: string | undefined = tenantHeader;

    // Strategy 1: Look up by Supabase authId
    let localUser = await prisma.user.findUnique({ where: { authId } });

    if (localUser) {
      // Update last login and email
      localUser = await prisma.user.update({
        where: { id: localUser.id },
        data: { lastLoginAt: new Date(), email },
      });
    } else {
      // Strategy 2: Look up by email (handles admin-created users)
      if (email) {
        localUser = await prisma.user.findFirst({
          where: { email, tenantId: tenantId || undefined },
        });
      }

      if (localUser) {
        // Link this Supabase authId to the existing local user
        localUser = await prisma.user.update({
          where: { id: localUser.id },
          data: { authId, lastLoginAt: new Date(), email },
        });
      } else {
        // Strategy 3: Create new local user
        if (!tenantId) {
          const defaultTenant = await prisma.tenant.findUnique({
            where: { slug: "default" },
          });
          if (!defaultTenant) {
            throw new AppError("No tenant configured. Contact platform admin.", 400);
          }
          tenantId = defaultTenant.id;
        }

        localUser = await prisma.user.create({
          data: {
            tenantId,
            authId,
            email,
            role: "FARMER",
            lastLoginAt: new Date(),
          },
        });
      }
    }

    // If tenant was resolved from header, verify the user belongs to that tenant
    if (tenantHeader && localUser.tenantId !== tenantHeader) {
      throw new AppError("User does not belong to the specified tenant", 403);
    }

    // Check tenant status — non-ACTIVE tenants cannot use the API
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: localUser.tenantId },
      select: { status: true },
    });
    if (tenantRecord && tenantRecord.status !== "ACTIVE") {
      const statusMsg =
        tenantRecord.status === "PENDING_APPROVAL"
          ? "Your tenant account is pending approval. Please wait for a platform administrator to activate it."
          : "Your tenant account has been suspended. Contact your platform administrator.";
      throw new AppError(statusMsg, 403);
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
      if (tenant && tenant.status === "ACTIVE") {
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
