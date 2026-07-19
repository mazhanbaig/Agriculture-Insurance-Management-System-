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

/**
 * Get usage summary for the tenant.
 * Query params: startDate, endDate (ISO strings, optional).
 */
export async function getUsageSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const usage = await billingService.getUsageSummary(req.user!.tenantId, startDate, endDate);
    res.json({ status: "success", data: usage });
  } catch (error) { next(error); }
}

/**
 * List invoices for the tenant (paginated).
 * Query params: page, limit (optional).
 */
export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await billingService.listInvoices(req.user!.tenantId, page, limit);
    res.json({ status: "success", ...result });
  } catch (error) { next(error); }
}

/**
 * Get a single invoice by ID.
 */
export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await billingService.getInvoice(req.user!.tenantId, req.params.id as string);
    res.json({ status: "success", data: invoice });
  } catch (error) { next(error); }
}

/**
 * Pay an invoice (mark as paid).
 */
export async function payInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await billingService.payInvoice(req.user!.tenantId, req.params.id as string);
    res.json({ status: "success", data: invoice, message: "Invoice marked as paid" });
  } catch (error) { next(error); }
}

/**
 * Manually trigger invoice generation for the current period.
 */
export async function generateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.generateInvoice(req.user!.tenantId);
    res.status(201).json({ status: "success", data: result });
  } catch (error) { next(error); }
}
