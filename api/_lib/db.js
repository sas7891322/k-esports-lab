import { neon } from "@neondatabase/serverless";

export function dbReady() {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  if (!process.env.DATABASE_URL) {
    const err = new Error("DATABASE_URL is not configured");
    err.code = "DB_NOT_CONFIGURED";
    throw err;
  }
  return neon(process.env.DATABASE_URL);
}

export async function listMatches() {
  const q = sql();
  const rows = await q`SELECT data FROM matches ORDER BY (data->>'date') ASC, (data->>'time') ASC`;
  return rows.map(r => r.data);
}

export async function getMatchById(id) {
  const q = sql();
  const rows = await q`SELECT data FROM matches WHERE id = ${id} LIMIT 1`;
  return rows[0]?.data || null;
}

export async function upsertMatch(match) {
  const q = sql();
  await q`
    INSERT INTO matches (id, data, updated_at)
    VALUES (${match.id}, ${JSON.stringify(match)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function deleteMatch(id) {
  const q = sql();
  await q`DELETE FROM matches WHERE id = ${id}`;
}

export async function ensureOrdersTable() {
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS orders (
      merchant_trade_no TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      client_token_hash TEXT NOT NULL,
      ecpay_trade_no TEXT,
      payment_type TEXT,
      rtn_code TEXT,
      rtn_msg TEXT,
      payment_info JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS orders_match_id_idx ON orders (match_id, status)`;
}

export async function createOrderRecord({ merchantTradeNo, matchId, amount, clientTokenHash }) {
  await ensureOrdersTable();
  const q = sql();
  await q`
    INSERT INTO orders (merchant_trade_no, match_id, amount, client_token_hash)
    VALUES (${merchantTradeNo}, ${matchId}, ${amount}, ${clientTokenHash})
  `;
}

export async function getOrder(merchantTradeNo) {
  await ensureOrdersTable();
  const q = sql();
  const rows = await q`
    SELECT merchant_trade_no, match_id, amount, status, client_token_hash,
           ecpay_trade_no, payment_type, rtn_code, rtn_msg, payment_info,
           created_at, paid_at
    FROM orders
    WHERE merchant_trade_no = ${merchantTradeNo}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function savePaymentInfo(merchantTradeNo, fields) {
  await ensureOrdersTable();
  const q = sql();
  await q`
    UPDATE orders
    SET payment_info = ${JSON.stringify(fields)}::jsonb,
        ecpay_trade_no = COALESCE(${fields.TradeNo || null}, ecpay_trade_no),
        payment_type = COALESCE(${fields.PaymentType || null}, payment_type)
    WHERE merchant_trade_no = ${merchantTradeNo}
  `;
}

export async function markOrderFromEcpay(merchantTradeNo, fields) {
  await ensureOrdersTable();
  const paid = String(fields.RtnCode || "") === "1";
  const q = sql();
  await q`
    UPDATE orders
    SET status = ${paid ? "paid" : "pending"},
        ecpay_trade_no = COALESCE(${fields.TradeNo || null}, ecpay_trade_no),
        payment_type = COALESCE(${fields.PaymentType || null}, payment_type),
        rtn_code = ${String(fields.RtnCode || "")},
        rtn_msg = ${String(fields.RtnMsg || "")},
        raw_result = ${JSON.stringify(fields)}::jsonb,
        paid_at = CASE WHEN ${paid} THEN COALESCE(paid_at, NOW()) ELSE paid_at END
    WHERE merchant_trade_no = ${merchantTradeNo}
  `;
}
