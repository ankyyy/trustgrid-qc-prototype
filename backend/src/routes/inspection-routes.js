import { Router } from "express";
import { createInspection } from "../controllers/inspection-controller.js";
import { uploadPhotos } from "../middleware/upload.js";
export const inspectionRouter = Router();
inspectionRouter.post("/", uploadPhotos, createInspection);
