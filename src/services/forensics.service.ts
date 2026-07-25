import exifr from "exifr";
import { prisma } from "../lib/prisma";
import logger from "../utils/logger";

export interface ExifResult {
  make?: string;
  model?: string;
  dateTimeOriginal?: Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  software?: string;
  orientation?: number;
  imageWidth?: number;
  imageHeight?: number;
  flash?: number;
  isoSpeedRatings?: number;
  focalLength?: number;
  allMetadata: Record<string, any>;
  suspiciousFlags: string[];
  exifPresent: boolean;
}

export interface ElaResult {
  elaScore: number;
  elaRegions: number;
  modified: boolean;
  detail: string;
}

export interface VideoAnalysisResult {
  duration?: number;
  codec?: string;
  width?: number;
  height?: number;
  keyframeCount: number;
  suspiciousFlags: string[];
}

export interface PdfAnalysisResult {
  pageCount: number;
  author?: string;
  creator?: string;
  producer?: string;
  title?: string;
  suspiciousFlags: string[];
  textContent?: string;
}

export interface AiGenResult {
  aiScore: number;
  indicators: string[];
  verdict: string;
}

export async function extractExif(filePath: string): Promise<ExifResult> {
  const suspiciousFlags: string[] = [];

  try {
    const allMetadata = await exifr.parse(filePath, true);
    if (!allMetadata || Object.keys(allMetadata).length === 0) {
      suspiciousFlags.push("EXIF_STRIPPED");
      return { exifPresent: false, allMetadata: {}, suspiciousFlags };
    }

    const gps = await exifr.gps(filePath).catch(() => null);
    const result: ExifResult = {
      make: allMetadata.Make || allMetadata.make,
      model: allMetadata.Model || allMetadata.model,
      dateTimeOriginal: allMetadata.DateTimeOriginal || allMetadata.datetimeOriginal,
      gpsLatitude: gps?.latitude ?? undefined,
      gpsLongitude: gps?.longitude ?? undefined,
      software: allMetadata.Software || allMetadata.software,
      orientation: allMetadata.Orientation || allMetadata.orientation,
      imageWidth: allMetadata.ImageWidth || allMetadata.imageWidth,
      imageHeight: allMetadata.ImageHeight || allMetadata.imageHeight,
      flash: allMetadata.Flash || allMetadata.flash,
      isoSpeedRatings: allMetadata.ISOSpeedRatings || allMetadata.isoSpeedRatings,
      focalLength: allMetadata.FocalLength || allMetadata.focalLength,
      allMetadata,
      suspiciousFlags: [],
      exifPresent: true,
    };

    if (result.software && /photoshop|gimp|lightroom|affinity|pixlr|canva|edit/i.test(result.software)) {
      suspiciousFlags.push("EDITOR_SOFTWARE_DETECTED");
    }
    if (!result.dateTimeOriginal) {
      suspiciousFlags.push("NO_DATE_ORIGINAL");
    }
    if (!gps) {
      suspiciousFlags.push("NO_GPS_DATA");
    }
    if (result.orientation && result.orientation !== 1) {
      suspiciousFlags.push("IMAGE_ROTATED");
    }

    result.suspiciousFlags = suspiciousFlags;
    return result;
  } catch (error) {
    logger.warn({ error, filePath }, "EXIF extraction failed");
    return { exifPresent: false, allMetadata: {}, suspiciousFlags: ["EXIF_EXTRACTION_FAILED"] };
  }
}

export async function computeEla(
  imagePath: string,
  threshold: number = 0.3
): Promise<ElaResult> {
  try {
    const sharp = require("sharp");
    const fs = require("fs");
    const path = require("path");

    const original = sharp(imagePath);
    const metadata = await original.metadata();
    if (!metadata.format) return { elaScore: 0, elaRegions: 0, modified: false, detail: "Cannot determine image format" };

    const tempPath = imagePath.replace(/(\.\w+)$/, `_ela_${Date.now()}$1`);
    await original.jpeg({ quality: 75 }).toFile(tempPath);

    const originalBuffer = fs.readFileSync(imagePath);
    const compressedBuffer = fs.readFileSync(tempPath);
    fs.unlinkSync(tempPath);

    const diffPixels = elaPixelDiff(originalBuffer, compressedBuffer);
    const pixelCount = (metadata.width || 1) * (metadata.height || 1);
    const diffRatio = diffPixels / pixelCount;

    return {
      elaScore: diffRatio,
      elaRegions: Math.round(diffRatio * 100),
      modified: diffRatio > threshold,
      detail: `ELA: ${(diffRatio * 100).toFixed(2)}% pixel difference (threshold: ${(threshold * 100).toFixed(0)}%)`,
    };
  } catch (error) {
    logger.warn({ error, imagePath }, "ELA analysis failed");
    return { elaScore: 0, elaRegions: 0, modified: false, detail: "ELA unavailable" };
  }
}

function elaPixelDiff(buf1: Buffer, buf2: Buffer): number {
  if (buf1.length === 0 || buf2.length === 0) return 0;
  let diff = 0;
  const len = Math.min(buf1.length, buf2.length);
  for (let i = 0; i < len; i++) {
    if (Math.abs(buf1[i] - buf2[i]) > 10) diff++;
  }
  return diff;
}

export async function analyzeVideo(videoPath: string): Promise<VideoAnalysisResult> {
  try {
    const ffprobe = require("fluent-ffmpeg").ffprobe;
    const metadata = await new Promise<any>((resolve, reject) => {
      ffprobe(videoPath, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const stream = metadata.streams?.find((s: any) => s.codec_type === "video");
    const suspiciousFlags: string[] = [];

    if (stream) {
      if (!stream.duration || stream.duration === 0) suspiciousFlags.push("NO_DURATION");
      if (stream.codec_name && !["h264", "hevc", "vp9", "av1"].includes(stream.codec_name)) {
        suspiciousFlags.push("UNUSUAL_CODEC");
      }
    }

    return {
      duration: stream?.duration,
      codec: stream?.codec_name,
      width: stream?.width,
      height: stream?.height,
      keyframeCount: 0,
      suspiciousFlags,
    };
  } catch (error) {
    logger.warn({ error, videoPath }, "Video analysis failed");
    return { keyframeCount: 0, suspiciousFlags: ["VIDEO_ANALYSIS_FAILED"] };
  }
}

export async function analyzePdf(pdfPath: string): Promise<PdfAnalysisResult> {
  try {
    const fs = require("fs");
    const PDFDocument = require("pdf-lib").PDFDocument;
    const pdfParse = require("pdf-parse");

    const fileBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const textData = await pdfParse(fileBuffer);

    const suspiciousFlags: string[] = [];
    const meta = pdfDoc.getTitle() ? { title: pdfDoc.getTitle() } : {};
    const creator = pdfDoc.getCreator ? pdfDoc.getCreator() : undefined;
    const producer = pdfDoc.getProducer ? pdfDoc.getProducer() : undefined;
    const author = pdfDoc.getAuthor ? pdfDoc.getAuthor() : undefined;

    if (producer && /pdfsam|sejda|ilovepdf|smallpdf|pdf24|cuten?pdf/i.test(producer)) {
      suspiciousFlags.push("PDF_MODIFIED");
    }
    if (!textData.text || textData.text.trim().length < 10) {
      suspiciousFlags.push("PDF_NO_TEXT_CONTENT");
    }

    return {
      pageCount: pdfDoc.getPageCount(),
      author,
      creator,
      producer,
      title: meta.title,
      suspiciousFlags,
      textContent: textData.text?.slice(0, 5000) || "",
    };
  } catch (error) {
    logger.warn({ error, pdfPath }, "PDF analysis failed");
    return { pageCount: 0, suspiciousFlags: ["PDF_ANALYSIS_FAILED"] };
  }
}

export async function detectAiGenerated(
  imagePath: string,
  exifResult: ExifResult
): Promise<AiGenResult> {
  const indicators: string[] = [];
  let aiScore = 0;

  if (exifResult.exifPresent) {
    const suspicious = exifResult.suspiciousFlags;
    if (suspicious.includes("NO_GPS_DATA") && suspicious.includes("NO_DATE_ORIGINAL")) {
      aiScore += 30;
      indicators.push("NO_GPS_OR_DATE");
    }
    if (suspicious.includes("EDITOR_SOFTWARE_DETECTED")) {
      aiScore += 15;
      indicators.push("EDITOR_SOFTWARE");
    }
    if (suspicious.includes("EXIF_STRIPPED")) {
      aiScore += 25;
      indicators.push("EXIF_STRIPPED_AI_GEN");
    }
  } else {
    aiScore += 20;
    indicators.push("EXIF_ABSENT");
  }

  try {
    const sharp = require("sharp");
    const metadata = await sharp(imagePath).metadata();
    if (metadata.width && metadata.height) {
      const ratio = metadata.width / metadata.height;
      if (Math.abs(ratio - 1) > 0.05 && (metadata.width <= 512 || metadata.height <= 512)) {
        if (Math.abs(ratio - 4 / 3) > 0.05 && Math.abs(ratio - 16 / 9) > 0.05) {
          aiScore += 10;
          indicators.push("UNUSUAL_ASPECT_RATIO");
        }
      }
    }
  } catch {
  }

  const verdict = aiScore >= 50 ? "SUSPECTED_AI" : aiScore >= 20 ? "UNCLEAR" : "LIKELY_AUTHENTIC";
  return { aiScore, indicators, verdict };
}
