import { z } from "zod";

export const subscribeSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
});

export const usageSummarySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const payInvoiceSchema = z.object({
  // No additional fields needed — invoice is identified by URL param
  paymentReference: z.string().optional(),
});

export const generateInvoiceSchema = z.object({
  // Optional override period (defaults to current month)
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});
