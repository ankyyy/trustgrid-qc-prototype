import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";
import { GeminiAnalysisService } from "../src/services/gemini-analysis-service.js";

async function withServer(callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health endpoint returns ok", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("inspection requires a supplier ID", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/inspections`, { method: "POST" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { detail: "A valid supplier ID is required." });
  });
});

test("inspection rejects unsupported file types", async () => {
  await withServer(async (baseUrl) => {
    const body = new FormData();
    body.append("supplier_id", "SUPPLIER-001");
    body.append("photos", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
    const response = await fetch(`${baseUrl}/api/inspections`, { method: "POST", body });
    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), { detail: "Only JPEG, PNG, and WebP images are allowed." });
  });
});

test("analysis service returns a deterministic mock without a key", async () => {
  const service = new GeminiAnalysisService({ apiKey: undefined, model: "gemini-3.6-flash", timeoutMs: 100 });
  const result = await service.analyze([]);
  assert.equal(result.model, "mock-gemini");
  assert.equal(result.analysis.foreign_stones_present, false);
});
