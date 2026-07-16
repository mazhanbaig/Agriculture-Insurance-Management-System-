import { z } from "zod";

export const purchasePolicySchema = z.object({
  policyPlanId: z.string().uuid(),
  landParcelId: z.string().uuid(),
  startDate: z.string().datetime(),
});
