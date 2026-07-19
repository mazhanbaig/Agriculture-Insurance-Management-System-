import Stripe from "stripe";
import { AppError } from "../middleware/errorHandler";

let stripeInstance: Stripe | null = null;

/**
 * Get the singleton Stripe client.
 * Initializes lazily to avoid import-time failure when env vars are missing.
 */
export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError(
      "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.",
      500
    );
  }
  stripeInstance = new Stripe(key, {
    apiVersion: "2025-02-24.acacia" as any,
  });
  return stripeInstance;
}
