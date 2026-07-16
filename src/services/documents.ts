import { prisma } from "../lib/prisma";
import { cloudinary } from "../lib/cloudinary";
import { ocrQueue } from "../lib/bullmq";
import { AppError } from "../middleware/errorHandler";

export async function uploadDocument(userId: string, claimId: string, type: string, filePath: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new AppError("Claim not found", 404);

  const result = await cloudinary.uploader.upload(filePath, {
    folder: `aims/claims/${claimId}`,
    resource_type: "auto",
    transformation: [{ quality: "auto", fetch_format: "auto" }, { width: 1200, height: 1200, crop: "limit" }],
  });

  const document = await prisma.claimDocument.create({
    data: { claimId, uploadedByUserId: userId, url: result.secure_url, type, fileSize: result.bytes, mimeType: result.format },
  });

  await ocrQueue.add("process-ocr", { documentId: document.id, imageUrl: result.secure_url });
  return document;
}

export async function getClaimDocuments(claimId: string) {
  return prisma.claimDocument.findMany({ where: { claimId }, orderBy: { uploadedAt: "desc" } });
}

export async function getDocument(documentId: string) {
  const document = await prisma.claimDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError("Document not found", 404);
  return document;
}

export async function deleteDocument(documentId: string, _userId: string) {
  const document = await prisma.claimDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError("Document not found", 404);
  const urlParts = document.url.split("/");
  const publicIdWithExt = urlParts[urlParts.length - 1] || "";
  const publicId = publicIdWithExt.split(".")[0];
  if (publicId) await cloudinary.uploader.destroy(`aims/claims/${document.claimId}/${publicId}`);
  await prisma.claimDocument.delete({ where: { id: documentId } });
}
