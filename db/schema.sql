-- PostgreSQL schema. Store objects in S3/GCS; image_uri is not an API data URL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE suppliers (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id text NOT NULL REFERENCES suppliers(id),
  status text NOT NULL CHECK (status IN ('pending', 'analyzed', 'failed')),
  model_name text,
  ai_result jsonb,
  -- Lab values deliberately separate from the AI response for calibration and audit.
  lab_result jsonb,
  lab_result_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  analyzed_at timestamptz
);

CREATE TABLE inspection_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  image_uri text NOT NULL,
  sha256 char(64) NOT NULL,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, position)
);
CREATE INDEX inspections_supplier_created_idx ON inspections (supplier_id, created_at DESC);
CREATE INDEX inspections_ai_result_gin_idx ON inspections USING gin (ai_result);
