import { Request, Response, NextFunction } from "express";
import { handleWebhookEvent } from "../services/billing.service";

/**
 * Stripe webhook endpoint.
 * Must receive the raw body to verify the Stripe signature.
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).json({ status: "error", message: "Missing stripe-signature header" });
      return;
    }

    // req.body is the raw buffer from express.raw()
    const rawBody = (req.body as Buffer).toString("utf8");
    const result = await handleWebhookEvent(rawBody, signature);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
