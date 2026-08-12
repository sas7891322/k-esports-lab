CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_date_idx
ON matches ((data->>'date'), (data->>'time'));
