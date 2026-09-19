import multer from "multer";
import { config } from "../config/env.js";
import { isAllowedImageMimeType } from "../validators/image-validator.js";
export const uploadPhotos = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxImageBytes, files: config.maxPhotos }, fileFilter: (_request, file, callback) => callback(null, isAllowedImageMimeType(file.mimetype)) }).array("photos", config.maxPhotos);
