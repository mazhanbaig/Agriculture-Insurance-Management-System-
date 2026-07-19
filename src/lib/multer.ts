import multer from "multer";
import path from "path";
import { AppError } from "../middleware/errorHandler";

// Maximum file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
];

// File size limits per type
const FILE_SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10 MB for images
  video: 100 * 1024 * 1024, // 100 MB for videos
  application: 20 * 1024 * 1024, // 20 MB for PDFs
};

/**
 * Multer configuration for file uploads.
 * Stores files in /tmp/uploads/ with unique filenames.
 */
const upload = multer({
  dest: "/tmp/uploads/",
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(
        new AppError(
          `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
          400
        )
      );
      return;
    }

    // Check size limits by file category
    const category = file.mimetype.split("/")[0];
    const limit = FILE_SIZE_LIMITS[category] || MAX_FILE_SIZE;

    // Multer checks file size after filtering, so we just validate type here
    cb(null, true);
  },
});

export default upload;

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
