import { z } from "zod";

export const createDocumentSchema = z.object({
  claimId: z.string().uuid(),
  type: z.string().min(1),
});
