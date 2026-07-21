import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { prisma } from "../lib/prisma";
import { cloudinary } from "../lib/cloudinary";
import { ocrQueue } from "../lib/bullmq";
import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";

/**
 * Allowed MIME types for uploaded claim documents.
 */
const ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "application/pdf",
];

const ALLOWED_MIME_DESCRIPTION =
  "JPEG, PNG, WebP, HEIC, TIFF images; MP4, MOV, AVI, WebM videos; PDF documents";

/**
 * Magic byte signatures for allowed file types.
 * Matched against the first bytes (hex) of the file buffer.
 */
const MAGIC_BYTES: Array<[string, string]> = [
  ["ffd8ff", "image/jpeg"],
  ["89504e47", "image/png"],
  ["000000186674797068656963", "image/heic"],
  ["000000186674797068656966", "image/heif"],
  ["49492a00", "image/tiff"],
  ["4d4d002a", "image/tiff"],
  ["000000146674797069736f6d", "video/mp4"],
  ["0000001c667479706d703432", "video/mp4"],
  ["000000206674797071742020", "video/quicktime"],
  ["1a45dfa3", "video/webm"],
  ["25504446", "application/pdf"],
];

/**
 * RIFF-based formats (WebP, AVI) are detected differently:
 * - Bytes 0-3 = "RIFF" (52494646) — common RIFF container
 * - Bytes 8-11 = subtype: "WEBP" (57454250) or "AVI " (41564920)
 */
function detectRiffSubtype(hex12: string): string | null {
  if (hex12.startsWith("57454250")) return "image/webp";
  if (hex12.startsWith("41564920")) return "video/x-msvideo";
  return null;
}

/**
 * Detect MIME type from a file buffer using magic byte signatures.
 * Returns null if no signature matches.
 */
function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  const hex = buffer.toString("hex").toLowerCase();

  // Special case: RIFF container (WebP, AVI) — "RIFF" at bytes 0-3, subtype at bytes 8-11
  if (hex.startsWith("52494646") && buffer.length >= 12) {
    const hex12 = buffer.subarray(8, 12).toString("hex").toLowerCase();
    return detectRiffSubtype(hex12);
  }

  // Standard magic byte matching
  for (const [magic, mime] of MAGIC_BYTES) {
    if (hex.startsWith(magic)) return mime;
  }

  return null;
}

/**
 * Upload a document to a claim with Layer 1 forensic checks.
 *
 * Forensic checks:
 * 1. SHA-256 hash — computed from file buffer, checked for duplicates
 * 2. MIME type — detected from magic bytes (not client extension)
 * 3. File size — captured from Cloudinary response
 */
export async function uploadDocument(
  userId: string,
  tenantId: string,
  claimId: string,
  type: string,
  filePath: string
) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, tenantId } });
  if (!claim) throw new AppError("Claim not found", 404);

  // ─── Layer 1: Read file once, compute hash + magic bytes ─────────

  const fileBuffer = await readFile(filePath);

  // SHA-256 hash
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  // Deduplication check (claim-scoped)
  const existingDoc = await prisma.claimDocument.findFirst({
    where: { claimId, fileHash },
  });
  if (existingDoc) {
    throw new AppError(
      `Duplicate file detected: this file was already uploaded as document ${existingDoc.id}`,
      409
    );
  }

  // MIME type detection from magic bytes
  const detectedMime = detectMimeFromBuffer(fileBuffer);
  const mimeType = detectedMime || "application/octet-stream";

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError(
      `File type "${mimeType}" is not supported. Allowed types: ${ALLOWED_MIME_DESCRIPTION}`,
      400
    );
  }

  // ─── Upload to Cloudinary ────────────────────────────────────────

  const result = await cloudinary.uploader.upload(filePath, {
    folder: `aims/claims/${claimId}`,
    resource_type: "auto",
    transformation: [
      { quality: "auto", fetch_format: "auto" },
      { width: 1200, height: 1200, crop: "limit" },
    ],
  });

  // ─── Create Document Record ──────────────────────────────────────

  const document = await prisma.claimDocument.create({
    data: {
      claimId,
      uploadedByUserId: userId,
      url: result.secure_url,
      type,
      fileSize: result.bytes,
      mimeType,
      fileHash,
    },
  });

  // Enqueue OCR processing
  await ocrQueue.add("process-ocr", {
    documentId: document.id,
    imageUrl: result.secure_url,
  });

  logger.info(
    {
      documentId: document.id,
      claimId,
      mimeType,
      fileHash: fileHash.slice(0, 16),
      fileSize: result.bytes,
    },
    "Document uploaded with Layer 1 forensics"
  );

  return document;
}

export async function getClaimDocuments(claimId: string) {
  return prisma.claimDocument.findMany({
    where: { claimId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getDocument(documentId: string) {
  const doc = await prisma.claimDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError("Document not found", 404);
  return doc;
}

export async function deleteDocument(documentId: string) {
  const doc = await prisma.claimDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError("Document not found", 404);

  const urlParts = doc.url.split("/");
  const publicId = urlParts[urlParts.length - 1]?.split(".")[0];
  if (publicId) {
    await cloudinary.uploader.destroy(`aims/claims/${doc.claimId}/${publicId}`);
  }

  await prisma.claimDocument.delete({ where: { id: documentId } });
}
