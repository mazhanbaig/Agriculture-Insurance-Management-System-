import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import pino from "pino";

const logger = pino();

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  if (err instanceof z.ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: (err as any).issues || (err as any).errors,
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
}
