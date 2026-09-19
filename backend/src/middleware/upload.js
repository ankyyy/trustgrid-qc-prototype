import multer from "multer";
import { config } from "../config/env.js";
import { AppError } from "../lib/app-error.js";
import { isAllowedImageMimeType } from "../validators/image-validator.js";
export const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: config.maxPhotos },
  fileFilter: (_request, file, callback) => {
    if (!isAllowedImageMimeType(file.mimetype)) return callback(new AppError(415, "Only JPEG, PNG, and WebP images are allowed."));
    return callback(null, true);
  }
}).array("photos", config.maxPhotos);
