import { Job } from "bullmq";
import { createWorker } from "tesseract.js";
import { prisma } from "../lib/prisma";
import logger from "../utils/logger";

let worker: any = null;

async function getWorker(): Promise<any> {
  if (worker) return worker;
  worker = await createWorker("eng");
  logger.info("Tesseract.js worker initialized");
  return worker;
}

export async function processOcrJob(job: Job): Promise<void> {
  const { documentId, imageUrl } = job.data as { documentId: string; imageUrl: string };

  logger.info({ documentId, imageUrl }, "Processing OCR job with Tesseract.js");

  try {
    const tessWorker = await getWorker();
    const { data } = await tessWorker.recognize(imageUrl);

    const extractedData = {
      processedAt: new Date().toISOString(),
      textFound: (data.text || "").trim().length > 0,
      confidence: data.confidence || 0,
      textLength: (data.text || "").length,
      words: (data.words || []).map((w: any) => ({
        text: w.text,
        confidence: w.confidence,
      })),
      textPreview: (data.text || "").slice(0, 5000),
    };

    await prisma.claimDocument.update({
      where: { id: documentId },
      data: {
        ocrExtractedData: extractedData,
      },
    });

    logger.info({ documentId, confidence: data.confidence, textLength: extractedData.textLength }, "OCR processing completed");
  } catch (error) {
    logger.error({ error, documentId }, "OCR processing failed, storing error");
    await prisma.claimDocument.update({
      where: { id: documentId },
      data: {
        ocrExtractedData: {
          processedAt: new Date().toISOString(),
          error: String(error),
          textFound: false,
          confidence: 0,
        },
      },
    });
  }
}
