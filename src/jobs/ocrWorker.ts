import { Job } from "bullmq";
import { prisma } from "../lib/prisma";
import pino from "pino";

const logger = pino({ name: "ocr-worker" });

/**
 * Process an OCR job for a claim document.
 * In MVP, this simulates OCR by extracting basic metadata.
 * In production, this would call a real OCR service.
 */
export async function processOcrJob(job: Job): Promise<void> {
  const { documentId } = job.data as { documentId: string };

  logger.info({ documentId }, "Processing OCR job");

  try {
    // Simulate OCR extraction
    const extractedData = {
      processedAt: new Date().toISOString(),
      textFound: true,
      confidence: 0.85,
      documentType: "claim_document",
    };

    await prisma.claimDocument.update({
      where: { id: documentId },
      data: {
        ocrExtractedData: extractedData,
      },
    });

    logger.info({ documentId }, "OCR processing completed");
  } catch (error) {
    logger.error({ error, documentId }, "OCR processing failed");
    throw error;
  }
}
