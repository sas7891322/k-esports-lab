CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_date_idx
ON matches ((data->>'date'), (data->>'time'));

CREATE TABLE IF NOT EXISTS orders (
  merchant_trade_no TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  environment TEXT NOT NULL DEFAULT 'unknown',
  client_token_hash TEXT NOT NULL,
  ecpay_trade_no TEXT,
  payment_type TEXT,
  rtn_code TEXT,
  rtn_msg TEXT,
  payment_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_match_id_idx ON orders (match_id, status);
