import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const PORT = Number(process.env.PORT ?? 8000);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_PHOTOS = 5;
const UPLOAD_DIR = path.resolve(projectRoot, process.env.UPLOAD_DIR ?? "uploads");
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SYSTEM_PROMPT = `You are TrustGrid QC, an industrial biomass intake assistant.
Inspect the supplied weighbridge photos. Return ONLY valid JSON with this exact shape:
{
  "moisture_percentage": number | null,
  "ash_content_percentage": number | null,
  "foreign_stones_present": boolean | null,
  "confidence": number,
  "notes": string
}
Estimates must be grounded in visible evidence. If an attribute cannot be estimated from
the image, use null and say why in notes. This is a screening result, not a lab result.`;

const app = express();
app.use(cors({
  origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((origin) => origin.trim()),
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Files stay in memory only long enough to validate, persist and submit to Gemini.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_PHOTOS },
  fileFilter: (_request, file, callback) => {
    callback(null, ALLOWED_MEDIA_TYPES.has(file.mimetype));
  }
});

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isExpectedImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).equals(Buffer.from("RIFF"))
    && buffer.subarray(8, 12).equals(Buffer.from("WEBP"));
  return false;
}

function validateImage(file) {
  if (!file?.buffer?.length) throw apiError(400, "An empty image was supplied.");
  if (file.size > MAX_IMAGE_BYTES) throw apiError(413, "Each image must be 15 MB or smaller.");
  if (!ALLOWED_MEDIA_TYPES.has(file.mimetype)) {
    throw apiError(415, "Only JPEG, PNG, and WebP images are allowed.");
  }
  if (!isExpectedImageSignature(file.buffer, file.mimetype)) {
    throw apiError(415, "Image file signature is invalid.");
  }
}

async function analyzeWithGemini(files) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      model: "mock-gemini",
      analysis: {
        moisture_percentage: 18.5,
        ash_content_percentage: 4.2,
        foreign_stones_present: false,
        confidence: 0.62,
        notes: "Mock result: configure GEMINI_API_KEY to run production analysis."
      }
    };
  }

  const parts = [
    { text: SYSTEM_PROMPT },
    ...files.map((file) => ({
      inline_data: { mime_type: file.mimetype, data: file.buffer.toString("base64") }
    }))
  ];
  const endpoint = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  );
  endpoint.searchParams.set("key", process.env.GEMINI_API_KEY);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 }
      })
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const body = await response.json();
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no response text");
    return { model: GEMINI_MODEL, analysis: JSON.parse(text) };
  } catch (error) {
    console.error("Gemini analysis failed:", error.message);
    throw apiError(502, "AI analysis is temporarily unavailable; retry this inspection.");
  }
}

app.get("/health", (_request, response) => response.json({ status: "ok" }));

app.post("/api/inspections", upload.array("photos", MAX_PHOTOS), async (request, response, next) => {
  try {
    const supplierId = request.body.supplier_id?.trim();
    if (!supplierId || supplierId.length > 100) throw apiError(400, "A valid supplier ID is required.");
    if (!request.files?.length || request.files.length > MAX_PHOTOS) {
      throw apiError(400, "Upload between 1 and 5 photos.");
    }
    request.files.forEach(validateImage);

    const inspectionId = crypto.randomUUID();
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const imageReferences = await Promise.all(request.files.map(async (file, index) => {
      const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype];
      const destination = path.join(UPLOAD_DIR, `${inspectionId}-${index + 1}${extension}`);
      await fs.writeFile(destination, file.buffer, { flag: "wx" });
      return destination;
    }));

    const { analysis, model } = await analyzeWithGemini(request.files);
    // Production: insert inspection/images/events in one transaction, then enqueue AI analysis.
    response.status(201).json({ inspection_id: inspectionId, supplier_id: supplierId, analysis, image_references: imageReferences, model });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ detail: "Each image must be 15 MB or smaller." });
  }
  if (error instanceof multer.MulterError) return response.status(400).json({ detail: error.message });
  return response.status(error.status ?? 500).json({ detail: error.status ? error.message : "Unexpected server error." });
});

app.listen(PORT, () => console.log(`TrustGrid QC API listening on http://localhost:${PORT}`));
