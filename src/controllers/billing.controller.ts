import { Request, Response, NextFunction } from "express";
import * as billingService from "../services/billing.service";

/**
 * Create a Stripe Checkout session for subscribing the tenant.
 */
export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.createSubscriptionSession(req.user!.tenantId);
    res.json({ status: "success", data: result });
  } catch (error) { next(error); }
}

/**
 * Cancel the tenant's subscription.
 */
export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    await billingService.cancelSubscription(req.user!.tenantId);
    res.json({ status: "success", message: "Subscription cancelled" });
  } catch (error) { next(error); }
}

/**
 * Get the tenant's subscription status.
 */
export async function getSubscriptionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await billingService.getSubscriptionStatus(req.user!.tenantId);
    res.json({ status: "success", data: status });
  } catch (error) { next(error); }
}
