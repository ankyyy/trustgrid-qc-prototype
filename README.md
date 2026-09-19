# TrustGrid QC prototype

Minimal end-to-end prototype for sending 1–5 biomass photos from a weighbridge UI to a protected Node.js backend for Gemini screening. The browser never sees the Gemini credential.

## Run locally

Requires Node.js 20+ (for built-in `fetch` and `AbortSignal.timeout`).

```bash
cp .env.example .env
cd backend
npm install
npm run dev
```

In another terminal, start the React frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Without `GEMINI_API_KEY`, the backend returns a clearly labelled deterministic mock so the workflow remains demonstrable. With a key, it posts the images directly from the server to Gemini using a constrained JSON prompt.

Run backend tests with:

```bash
cd backend
npm test
```

## Architecture

```text
React inspector app
        │  multipart images + supplier ID
        ▼
Node.js / Express API ──► private object storage (local adapter in this demo)
        │
        ▼
Gemini 3.6 Flash ──► structured inspection JSON
        │
        ▼
PostgreSQL inspection + append-only events + later lab result
```

The backend is split into `routes`, `controllers`, `services`, `validators`, and `middleware`. The local storage and Gemini services are adapter boundaries: production can replace them with S3/GCS resumable uploads, queue workers, and another AI provider without changing the HTTP route.

## API contract

### `POST /api/inspections`

Submit `multipart/form-data` with `supplier_id` (up to 100 characters) and `photos` (one to five JPEG, PNG, or WebP images; 15 MB maximum each).

On success, the endpoint returns HTTP `201`:

```json
{
  "inspection_id": "uuid",
  "supplier_id": "SUPPLIER-001",
  "analysis": {
    "moisture_percentage": null,
    "ash_content_percentage": null,
    "foreign_stones_present": false,
    "confidence": 0.65,
    "notes": "Visible evidence and limitations"
  },
  "image_references": ["uploads/uuid-1.jpg"],
  "model": "gemini-3.6-flash"
}
```

Common errors: `400` invalid request, `413` file too large, `415` unsupported image type, and `502` Gemini temporarily unavailable.

## Demo result and quality boundary

A real Gemini test using a timber-load image correctly returned `foreign_stones_present: false` and used `null` for moisture and ash because those measurements cannot be reliably inferred from a photograph alone. TrustGrid QC is a rapid visual screening tool; physical lab results are the ground truth captured later for calibration.

## Security and architecture

- The API key lives only in a server environment variable; it is neither returned nor bundled in the frontend.
- The Express backend uses Multer's in-memory upload handling with a 15 MB per-image limit and maximum of five files. It validates MIME types and image signatures, generates safe filenames, CORS-allows only configured origins, applies a Gemini timeout, and returns generic upstream errors.
- `db/schema.sql` stores a supplier link, object-storage image references, Gemini output as `JSONB`, later physical lab result, and an append-only inspection-events ledger. In production the API would write inspection, images, and ledger events in one transaction, upload media to private object storage, and provide signed read URLs only to authorized users.
- The Gemini call is intentionally server-side. A production deployment would add user authentication, supplier authorization, rate limits, malware scanning, durable queues, audit logs, encrypted storage, and secret-manager credentials.

## Network drops during a 15 MB mobile upload

A single multipart request is not resilient enough on its own. The production mobile client first creates an `inspection` record in `pending_upload` state, then asks the backend for short-lived, scoped **multipart/resumable object-storage upload URLs** (S3 multipart or GCS resumable). It persists the upload session ID, uploaded part numbers/checksums, and local file metadata in IndexedDB.

If 3G/4G/5G drops, the request fails without creating an analysis. The client shows “waiting for connection,” retries with exponential backoff plus jitter when `online` returns, queries the upload session for completed chunks, and resumes only missing chunks. Each part uses checksums and an idempotency key, avoiding duplicated photos or analyses. Once all five objects are verified, the client calls a small `complete-upload` endpoint; a queue worker invokes Gemini exactly once and updates the inspection. Upload sessions expire and orphaned objects are cleaned up. This makes the large transfer recoverable rather than retrying all 15 MB.

For this lightweight demo, `POST /api/inspections` receives multipart form data directly. Its client-side state does surface an upload error, but resumable storage is the production design above.

## MVP tradeoffs and production path

This MVP deliberately uses one synchronous API request and local storage to keep the workflow runnable in minutes. A production deployment would create the inspection first, use signed resumable uploads with local retry state, verify object checksums, and enqueue a single idempotent analysis job. The worker would transactionally record the AI result and append an audit event; later lab-result events become calibration data. This is the path that supports weak factory-gate connectivity without duplicating uploads or analyses.
