import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/app-error.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { GeminiAnalysisService } from "../src/services/gemini-analysis.service.js";
import { validateImage } from "../src/validators/image.validator.js";

function responseRecorder() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("validator accepts a genuine JPEG signature", () => {
  const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
  assert.doesNotThrow(() => validateImage(file, 15 * 1024 * 1024));
});

test("validator rejects a file with a spoofed MIME type", () => {
  const file = { buffer: Buffer.from("not a JPEG"), size: 10, mimetype: "image/jpeg" };
  assert.throws(() => validateImage(file, 15 * 1024 * 1024), { status: 415, message: "Image file signature is invalid." });
});

test("error handler returns the intended client error", () => {
  const response = responseRecorder();
  errorHandler(new AppError(415, "Only JPEG, PNG, and WebP images are allowed."), {}, response, () => {});
  assert.equal(response.statusCode, 415);
  assert.deepEqual(response.body, { detail: "Only JPEG, PNG, and WebP images are allowed." });
});

test("analysis service returns a deterministic mock without a key", async () => {
  const service = new GeminiAnalysisService({ apiKey: undefined, model: "gemini-3.6-flash", timeoutMs: 100 });
  const result = await service.analyze([]);
  assert.equal(result.model, "mock-gemini");
  assert.equal(result.analysis.foreign_stones_present, false);
});
