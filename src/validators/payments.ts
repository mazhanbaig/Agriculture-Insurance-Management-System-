import { z } from "zod";
export const createPaymentIntentSchema = z.object({ policyId: z.string().uuid() });
export const processPayoutSchema = z.object({ claimId: z.string().uuid(), amount: z.number().positive() });
