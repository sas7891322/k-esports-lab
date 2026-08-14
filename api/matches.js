import { dbReady, listMatches } from "./_lib/db.js";

const PREMIUM_DEEP_FIELDS = [
  "recent",
  "matchup",
  "bp",
  "conditions",
  "risk",
  "variance",
  "recommendationSecondary",
  "market"
];

const PREMIUM_PREMATCH_FIELDS = [
  "recommendationPrimary",
  "prediction"
];

function publicView(match) {
  if (!match?.premium) return match;

  const copy = { ...match };

  // 深度內容永遠不透過公開 API 提供。
  PREMIUM_DEEP_FIELDS.forEach(k => delete copy[k]);
  delete copy.premiumUnlocked;

  // 焦點賽事在完賽前維持賽事傾向與預測比分鎖定；
  // 完賽後只公開這兩項，讓所有人可以驗證賽前預測紀錄。
  if (copy.status !== "finished") {
    PREMIUM_PREMATCH_FIELDS.forEach(k => delete copy[k]);
    copy.locked = true;
  } else {
    copy.locked = false;
    copy.finishedReview = true;
  }

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
