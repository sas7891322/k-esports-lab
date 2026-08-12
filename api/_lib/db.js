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
