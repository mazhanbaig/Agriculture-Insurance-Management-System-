import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

/**
 * Middleware that blocks farmer-facing payment routes when the
 * FARMER_ONLINE_PAYMENTS_ENABLED env flag is not set to "true".
 *
 * When disabled, returns a clear 403 message directing farmers
 * to submit a purchase request instead.
 */
export function requireFarmerPaymentsEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  const enabled = process.env.FARMER_ONLINE_PAYMENTS_ENABLED === "true";
  if (!enabled) {
    next(
      new AppError(
        "Online purchase is disabled, submit a purchase request instead",
        403
      )
    );
    return;
  }
  next();
}
