-- EMBER Postgres + pgvector schema (runs automatically on first `docker compose up`).
-- Re-apply manually:  docker exec -i ember-db psql -U ember -d ember < backend/app/db/schema.sql
-- Mirrors contracts/schema_v1.json. Embedding dim must match EMBED_DIM (bge-small = 384).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS investigations (
  id             TEXT PRIMARY KEY,            -- e.g. 'BASS-II'
  program        TEXT NOT NULL,
  title          TEXT NOT NULL,
  summary        TEXT DEFAULT '',
  source_doc_id  TEXT
);

CREATE TABLE IF NOT EXISTS test_runs (
  experiment_id              TEXT PRIMARY KEY,
  investigation_id           TEXT REFERENCES investigations(id),
  program                    TEXT NOT NULL,
  fuel_material              TEXT NOT NULL,
  fuel_geometry              TEXT NOT NULL,
  gravity_g                  REAL NOT NULL,
  oxygen_pct                 REAL NOT NULL,
  pressure_kpa               REAL NOT NULL,
  flow_velocity_cm_s         REAL NOT NULL,
  diluent_gas                TEXT NOT NULL,
  combustion_regime          TEXT NOT NULL,
  spread_or_burn_rate        REAL,
  peak_radiative_flux_kw_m2  REAL,
  limiting_oxygen_index_pct  REAL,
  burn_duration_s            REAL,
  source_doc_id              TEXT,
  source_page                INT,
  extra_telemetry            JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_flags               TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS test_runs_program_idx ON test_runs (program);
CREATE INDEX IF NOT EXISTS test_runs_material_idx ON test_runs (fuel_material);

CREATE TABLE IF NOT EXISTS telemetry (
  experiment_id  TEXT PRIMARY KEY REFERENCES test_runs(experiment_id) ON DELETE CASCADE,
  series         JSONB NOT NULL               -- {time_s:[], flame_radius_mm:[], d_squared_mm2:[]|null, ...}
);

CREATE TABLE IF NOT EXISTS chunks (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     TEXT NOT NULL,
  page       INT  NOT NULL,
  section    TEXT,
  text       TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding  vector(384),
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(section, '') || ' ' || text)) STORED
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks (doc_id);

-- Read-only role for the RAG sql_tool (defence in depth on top of whitelisted queries)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ember_ro') THEN
    CREATE ROLE ember_ro LOGIN PASSWORD 'ember_ro';
  END IF;
END $$;
GRANT CONNECT ON DATABASE ember TO ember_ro;
GRANT USAGE ON SCHEMA public TO ember_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ember_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ember_ro;
