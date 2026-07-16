import { z } from "zod";
export const createDocumentSchema = z.object({ claimId: z.string().uuid(), type: z.string().min(1) });
export const getSignedUploadUrlSchema = z.object({ fileName: z.string().min(1), fileType: z.string().min(1), claimId: z.string().uuid(), documentType: z.string().min(1) });
