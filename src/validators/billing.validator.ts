import { z } from "zod";

export const subscribeSchema = z.object({
  // No additional fields needed — subscription is tied to authenticated user's tenant
  returnUrl: z.string().url().optional(),
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
});
