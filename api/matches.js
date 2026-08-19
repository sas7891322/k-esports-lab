import { dbReady, listMatches } from "./_lib/db.js";

const PREMIUM_DEEP_FIELDS = [
  "recent",
  "matchup",
  "bp",
  "conditions",
  "variance",
  "risk",
  "market",
  "recommendationSecondary"
];

function publicView(match) {
  if (!match?.premium) return match;
  const copy = { ...match };
  PREMIUM_DEEP_FIELDS.forEach(k => delete copy[k]);

  // 賽前：賽事觀點與預測比分也維持鎖定。
  // 賽後：只公開原預測結論與最終賽果，深度分析內容仍不公開。
  if (match.status !== "finished") {
    delete copy.recommendationPrimary;
    delete copy.prediction;
  }
  copy.locked = match.status !== "finished";
  return copy;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  if (!dbReady()) {
    res.status(503).json({ error: "DB_NOT_CONFIGURED" });
    return;
  }

  try {
    const matches = await listMatches();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(200).json({ matches: matches.map(publicView) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCHES_READ_FAILED" });
  }
}
