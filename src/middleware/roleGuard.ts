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
