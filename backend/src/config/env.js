import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(projectRoot, ".env") });
export const config = {
  port: Number(process.env.PORT ?? 8000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((value) => value.trim()),
  uploadDir: path.resolve(projectRoot, process.env.UPLOAD_DIR ?? "uploads"),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  geminiTimeoutMs: 45_000,
  maxImageBytes: 15 * 1024 * 1024,
  maxPhotos: 5
};
