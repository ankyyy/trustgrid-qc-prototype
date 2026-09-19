import { AppError } from "../lib/app-error.js";
const systemPrompt = `You are TrustGrid QC, an industrial biomass intake assistant. Inspect the supplied weighbridge photos. Return ONLY valid JSON with this exact shape: {"moisture_percentage": number | null, "ash_content_percentage": number | null, "foreign_stones_present": boolean | null, "confidence": number, "notes": string}. Estimates must be grounded in visible evidence. If an attribute cannot be estimated from the image, use null and say why in notes. This is a screening result, not a lab result.`;
export class GeminiAnalysisService {
  constructor({ apiKey, model, timeoutMs }) { Object.assign(this, { apiKey, model, timeoutMs }); }
  async analyze(files) {
    if (!this.apiKey) return { model: "mock-gemini", analysis: { moisture_percentage: 18.5, ash_content_percentage: 4.2, foreign_stones_present: false, confidence: 0.62, notes: "Mock result: configure GEMINI_API_KEY to run production analysis." } };
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey }, signal: AbortSignal.timeout(this.timeoutMs), body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: systemPrompt }, ...files.map((file) => ({ inline_data: { mime_type: file.mimetype, data: file.buffer.toString("base64") } }))] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
      if (!response.ok) { console.error(`Gemini request failed (${response.status}):`, await response.text()); throw new Error(`Gemini returned ${response.status}`); }
      const body = await response.json(); const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no response text");
      return { model: this.model, analysis: JSON.parse(text) };
    } catch (error) { console.error("Gemini analysis failed:", error.message); throw new AppError(502, "AI analysis is temporarily unavailable; retry this inspection."); }
  }
}
