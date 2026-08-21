import { randomUUID } from "crypto";
import { sql } from "./db.js";

const COOKIE_NAME = "kel_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function cookieValue(req, name) {
  const raw = String(req?.headers?.cookie || "");
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}

function safeVisitorId(value) {
  const v = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(v) ? v : "";
}

function isAdminRequest(req) {
  const ref = String(req?.headers?.referer || "");
  if (!ref) return false;
  try {
    const u = new URL(ref);
    return /\/admin(?:-login)?\.html$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function pagePath(req) {
  const ref = String(req?.headers?.referer || "");
  if (!ref) return "/site";
  try {
    const u = new URL(ref);
    let path = u.pathname || "/";
    if (path.endsWith("/match.html")) {
      const id = String(u.searchParams.get("id") || "").slice(0, 120);
      if (id) path += `?id=${id}`;
    } else if (path.endsWith("/league.html")) {
      const league = String(u.searchParams.get("league") || "").slice(0, 20);
      if (league) path += `?league=${league}`;
    }
    return path.slice(0, 240);
  } catch {
    return "/site";
  }
}

async function ensureTrafficTable() {
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS site_traffic (
      visit_date DATE NOT NULL,
      visitor_id TEXT NOT NULL,
      page_path TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (visit_date, visitor_id, page_path)
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS site_traffic_date_idx ON site_traffic (visit_date)`;
  await q`CREATE INDEX IF NOT EXISTS site_traffic_visitor_idx ON site_traffic (visitor_id)`;
}

export async function recordTrafficVisit(req, res) {
  if (isAdminRequest(req)) return { counted: false, admin: true };

  await ensureTrafficTable();

  let visitorId = safeVisitorId(cookieValue(req, COOKIE_NAME));
  if (!visitorId) {
    visitorId = randomUUID().replace(/-/g, "");
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`
    );
  }

  const path = pagePath(req);
  const q = sql();

  await q`
    INSERT INTO site_traffic (visit_date, visitor_id, page_path, views, first_seen, last_seen)
    VALUES ((NOW() AT TIME ZONE 'Asia/Taipei')::date, ${visitorId}, ${path}, 1, NOW(), NOW())
    ON CONFLICT (visit_date, visitor_id, page_path)
    DO UPDATE SET
      views = site_traffic.views +
        CASE
          WHEN site_traffic.last_seen < NOW() - INTERVAL '10 seconds' THEN 1
          ELSE 0
        END,
      last_seen = NOW()
  `;

  return { counted: true };
}

export async function getTrafficStats() {
  await ensureTrafficTable();
  const q = sql();

  const [todayRows, totalRows, sevenRows] = await Promise.all([
    q`
      SELECT
        COUNT(DISTINCT visitor_id)::int AS visitors,
        COALESCE(SUM(views), 0)::int AS views
      FROM site_traffic
      WHERE visit_date = (NOW() AT TIME ZONE 'Asia/Taipei')::date
    `,
    q`
      SELECT
        COUNT(DISTINCT visitor_id)::int AS visitors,
        COALESCE(SUM(views), 0)::int AS views
      FROM site_traffic
    `,
    q`
      SELECT
        COUNT(DISTINCT visitor_id)::int AS visitors,
        COALESCE(SUM(views), 0)::int AS views
      FROM site_traffic
      WHERE visit_date >= (NOW() AT TIME ZONE 'Asia/Taipei')::date - 6
    `
  ]);

  return {
    todayVisitors: Number(todayRows[0]?.visitors || 0),
    todayViews: Number(todayRows[0]?.views || 0),
    totalVisitors: Number(totalRows[0]?.visitors || 0),
    totalViews: Number(totalRows[0]?.views || 0),
    sevenDayVisitors: Number(sevenRows[0]?.visitors || 0),
    sevenDayViews: Number(sevenRows[0]?.views || 0)
  };
}
