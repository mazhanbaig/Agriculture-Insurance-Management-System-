import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Middleware factory that validates the request body against a Zod schema.
 */
export function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        _res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors: (error as any).issues || (error as any).errors,
        });
        return;
      }
      next(error);
    }
  };
}
