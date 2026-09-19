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

## Security and architecture

- The API key lives only in a server environment variable; it is neither returned nor bundled in the frontend.
- The Express backend uses Multer's in-memory upload handling with a 15 MB per-image limit and maximum of five files. It validates MIME types and image signatures, generates safe filenames, CORS-allows only configured origins, applies a Gemini timeout, and returns generic upstream errors.
- `db/schema.sql` stores a supplier link, object-storage image references, Gemini output as `JSONB`, later physical lab result, and an append-only inspection-events ledger. In production the API would write inspection, images, and ledger events in one transaction, upload media to private object storage, and provide signed read URLs only to authorized users.
- The Gemini call is intentionally server-side. A production deployment would add user authentication, supplier authorization, rate limits, malware scanning, durable queues, audit logs, encrypted storage, and secret-manager credentials.

## Network drops during a 15 MB mobile upload

A single multipart request is not resilient enough on its own. The production mobile client first creates an `inspection` record in `pending_upload` state, then asks the backend for short-lived, scoped **multipart/resumable object-storage upload URLs** (S3 multipart or GCS resumable). It persists the upload session ID, uploaded part numbers/checksums, and local file metadata in IndexedDB.

If 3G/4G/5G drops, the request fails without creating an analysis. The client shows “waiting for connection,” retries with exponential backoff plus jitter when `online` returns, queries the upload session for completed chunks, and resumes only missing chunks. Each part uses checksums and an idempotency key, avoiding duplicated photos or analyses. Once all five objects are verified, the client calls a small `complete-upload` endpoint; a queue worker invokes Gemini exactly once and updates the inspection. Upload sessions expire and orphaned objects are cleaned up. This makes the large transfer recoverable rather than retrying all 15 MB.

For this lightweight demo, `POST /api/inspections` receives multipart form data directly. Its client-side state does surface an upload error, but resumable storage is the production design above.
