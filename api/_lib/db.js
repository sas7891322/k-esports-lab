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
    )
  `;
  // Existing v2.3 databases are upgraded automatically without deleting data.
  await q`ALTER TABLE orders ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'unknown'`;
  // v2.3 曾把綠界 SimulatePaid=1 誤當成真實付款；v2.4 自動撤銷這類 legacy 測試解鎖。
  await q`
    UPDATE orders
    SET status = 'pending',
        paid_at = NULL,
        environment = CASE WHEN environment = 'unknown' THEN 'stage' ELSE environment END
    WHERE status = 'paid'
      AND raw_result->>'SimulatePaid' = '1'
  `;
  await q`CREATE INDEX IF NOT EXISTS orders_match_id_idx ON orders (match_id, status)`;
}

export async function createOrderRecord({ merchantTradeNo, matchId, amount, clientTokenHash, environment }) {
  await ensureOrdersTable();
  const q = sql();
  await q`
    INSERT INTO orders (merchant_trade_no, match_id, amount, client_token_hash, environment)
    VALUES (${merchantTradeNo}, ${matchId}, ${amount}, ${clientTokenHash}, ${environment || "unknown"})
  `;
}

export async function getOrder(merchantTradeNo) {
  await ensureOrdersTable();
  const q = sql();
  const rows = await q`
    SELECT merchant_trade_no, match_id, amount, status, environment, client_token_hash,
           ecpay_trade_no, payment_type, rtn_code, rtn_msg, payment_info, raw_result,
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

export async function recordEcpayReturn(merchantTradeNo, fields) {
  await ensureOrdersTable();
  const q = sql();
  await q`
    UPDATE orders
    SET ecpay_trade_no = COALESCE(${fields.TradeNo || null}, ecpay_trade_no),
        payment_type = COALESCE(${fields.PaymentType || null}, payment_type),
        rtn_code = ${String(fields.RtnCode || "")},
        rtn_msg = ${String(fields.RtnMsg || "")},
        raw_result = ${JSON.stringify(fields)}::jsonb
    WHERE merchant_trade_no = ${merchantTradeNo}
  `;
}

export async function markOrderFromEcpay(merchantTradeNo, fields) {
  await ensureOrdersTable();
  const q = sql();
  // 僅由已驗證、非 SimulatePaid 的 RtnCode=1 通知呼叫此函式。
  await q`
    UPDATE orders
    SET status = 'paid',
        ecpay_trade_no = COALESCE(${fields.TradeNo || null}, ecpay_trade_no),
        payment_type = COALESCE(${fields.PaymentType || null}, payment_type),
        rtn_code = ${String(fields.RtnCode || "")},
        rtn_msg = ${String(fields.RtnMsg || "")},
        raw_result = ${JSON.stringify(fields)}::jsonb,
        paid_at = COALESCE(paid_at, NOW())
    WHERE merchant_trade_no = ${merchantTradeNo}
  `;
}

export async function markStageOrderUnlocked(merchantTradeNo) {
  await ensureOrdersTable();
  const q = sql();
  await q`
    UPDATE orders
    SET status = 'stage_paid',
        paid_at = COALESCE(paid_at, NOW())
    WHERE merchant_trade_no = ${merchantTradeNo}
      AND environment = 'stage'
      AND status <> 'paid'
  `;
}

export async function ensureMatchRemindersTable() {
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS match_reminders (
      match_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (match_id, endpoint)
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS match_reminders_match_idx ON match_reminders (match_id)`;
}

export async function upsertMatchReminder(matchId, subscription) {
  await ensureMatchRemindersTable();
  const q = sql();
  const endpoint = String(subscription?.endpoint || "");
  await q`
    INSERT INTO match_reminders (match_id, endpoint, subscription, updated_at)
    VALUES (${matchId}, ${endpoint}, ${JSON.stringify(subscription)}::jsonb, NOW())
    ON CONFLICT (match_id, endpoint)
    DO UPDATE SET subscription = EXCLUDED.subscription, updated_at = NOW()
  `;
}

export async function removeMatchReminder(matchId, endpoint) {
  await ensureMatchRemindersTable();
  const q = sql();
  await q`DELETE FROM match_reminders WHERE match_id = ${matchId} AND endpoint = ${endpoint}`;
}

export async function listMatchReminders(matchId) {
  await ensureMatchRemindersTable();
  const q = sql();
  const rows = await q`SELECT endpoint, subscription FROM match_reminders WHERE match_id = ${matchId} ORDER BY created_at ASC LIMIT 500`;
  return rows.map(row => ({ endpoint: row.endpoint, subscription: row.subscription }));
}

export async function clearMatchReminders(matchId) {
  await ensureMatchRemindersTable();
  const q = sql();
  await q`DELETE FROM match_reminders WHERE match_id = ${matchId}`;
}

