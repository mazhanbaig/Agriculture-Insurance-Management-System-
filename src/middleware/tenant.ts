import { Request, Response, NextFunction } from "express";

/**
 * Extend Express Request to include tenantSlug and requestId.
 */
declare global {
  namespace Express {
    interface Request {
      tenantSlug?: string;
      requestId?: string;
    }
  }
}

/**
 * Tenant resolution middleware.
 * Resolves the tenant slug from the x-tenant-slug header.
 * In development, defaults to "default" if no header is present.
 */
export function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantSlug = req.headers["x-tenant-slug"] as string | undefined;
  req.tenantSlug = tenantSlug || "default";
  next();
}
