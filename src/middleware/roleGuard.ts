import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

/**
 * Role guard middleware factory.
 * Returns middleware that checks if the authenticated user has one of the allowed roles.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        new AppError(
          `Access denied. Required role: ${roles.join(" or ")}`,
          403
        )
      );
      return;
    }

    next();
  };
}

/**
 * Tenant access guard.
 * Ensures the user belongs to the tenant resolved from the request.
 * Only applies to tenant-scoped routes (not platform routes).
 */
export function requireTenantAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError("Authentication required", 401));
    return;
  }

  // Platform admins can access any tenant
  if (req.user.role === "PLATFORM_ADMIN") {
    next();
    return;
  }

  // If a tenant is resolved on the request, verify user belongs to it
  if (req.tenant && req.user.tenantId !== req.tenant.id) {
    next(new AppError("Access denied. User does not belong to this tenant.", 403));
    return;
  }

  next();
}
