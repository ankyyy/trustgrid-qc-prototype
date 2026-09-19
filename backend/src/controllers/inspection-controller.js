import crypto from "node:crypto";
import { config } from "../config/env.js";
import { AppError } from "../lib/app-error.js";
import { GeminiAnalysisService } from "../services/gemini-analysis-service.js";
import { LocalImageStorage } from "../services/local-image-storage.js";
import { validateImage } from "../validators/image-validator.js";
const imageStorage = new LocalImageStorage(config.uploadDir);
const analysisService = new GeminiAnalysisService({ apiKey: config.geminiApiKey, model: config.geminiModel, timeoutMs: config.geminiTimeoutMs });
export async function createInspection(request, response, next) {
  try {
    const supplierId = request.body.supplier_id?.trim();
    if (!supplierId || supplierId.length > 100) throw new AppError(400, "A valid supplier ID is required.");
    if (!request.files?.length || request.files.length > config.maxPhotos) throw new AppError(400, "Upload between 1 and 5 photos.");
    request.files.forEach((file) => validateImage(file, config.maxImageBytes));
    const inspectionId = crypto.randomUUID();
    const imageReferences = await imageStorage.saveInspectionImages(inspectionId, request.files);
    const { analysis, model } = await analysisService.analyze(request.files);
    return response.status(201).json({ inspection_id: inspectionId, supplier_id: supplierId, analysis, image_references: imageReferences, model });
  } catch (error) { return next(error); }
}
