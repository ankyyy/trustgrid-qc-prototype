"""TrustGrid QC API: upload truck-load photos and return an AI assessment."""
from __future__ import annotations

import base64
import json
import os
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_PHOTOS = 5
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp"}

SYSTEM_PROMPT = """You are TrustGrid QC, an industrial biomass intake assistant.
Inspect the supplied weighbridge photos. Return ONLY valid JSON with this exact shape:
{
  "moisture_percentage": number | null,
  "ash_content_percentage": number | null,
  "foreign_stones_present": boolean | null,
  "confidence": number,
  "notes": string
}
Estimates must be grounded in visible evidence. If an attribute cannot be estimated from
the image, use null and say why in notes. This is a screening result, not a lab result."""


class InspectionResult(BaseModel):
    inspection_id: str
    supplier_id: str
    analysis: dict[str, Any]
    image_references: list[str]
    model: str


app = FastAPI(title="TrustGrid QC API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


def validate_image(data: bytes, content_type: str | None) -> None:
    if not data:
        raise HTTPException(status_code=400, detail="An empty image was supplied.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Each image must be 15 MB or smaller.")
    if content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP images are allowed.")
    # Content-type alone is client-controlled; reject obvious non-image payloads.
    signatures = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")
    if not data.startswith(signatures):
        raise HTTPException(status_code=415, detail="Image file signature is invalid.")


async def analyze_with_gemini(images: list[tuple[bytes, str]]) -> tuple[dict[str, Any], str]:
    """Use Gemini when configured; a deterministic mock keeps the exercise runnable."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ({
            "moisture_percentage": 18.5,
            "ash_content_percentage": 4.2,
            "foreign_stones_present": False,
            "confidence": 0.62,
            "notes": "Mock result: configure GEMINI_API_KEY to run production analysis.",
        }, "mock-gemini")

    parts: list[dict[str, Any]] = [{"text": SYSTEM_PROMPT}]
    parts.extend({"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}
                 for data, mime in images)
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, params={"key": api_key}, json=payload)
            response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text), GEMINI_MODEL
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
        # Do not leak provider responses or credentials to clients.
        raise HTTPException(status_code=502, detail="AI analysis is temporarily unavailable; retry this inspection.") from exc


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/inspections", response_model=InspectionResult, status_code=status.HTTP_201_CREATED)
async def create_inspection(
    supplier_id: str = Form(..., min_length=1, max_length=100),
    photos: list[UploadFile] = File(...),
) -> InspectionResult:
    if not 1 <= len(photos) <= MAX_PHOTOS:
        raise HTTPException(status_code=400, detail="Upload between 1 and 5 photos.")
    # Read once so validation, persistence and API payload all refer to the same bytes.
    files: list[tuple[bytes, str, str]] = []
    for photo in photos:
        data = await photo.read()
        validate_image(data, photo.content_type)
        files.append((data, photo.content_type or "image/jpeg", photo.filename or "photo"))

    inspection_id = str(uuid.uuid4())
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    image_references: list[str] = []
    for position, (data, _mime, filename) in enumerate(files, start=1):
        # Generated names prevent path traversal and permit replacement with object storage later.
        suffix = Path(filename).suffix.lower() or ".jpg"
        destination = UPLOAD_DIR / f"{inspection_id}-{position}{suffix}"
        destination.write_bytes(data)
        image_references.append(str(destination))

    analysis, model = await analyze_with_gemini([(data, mime) for data, mime, _ in files])
    # Production: transactionally insert inspection + image rows + analysis JSONB (db/schema.sql).
    return InspectionResult(inspection_id=inspection_id, supplier_id=supplier_id,
                            analysis=analysis, image_references=image_references, model=model)
