import { dbReady, listMatches } from "./_lib/db.js";

const LOCKED_FIELDS = [
  "recent","matchup","bp","conditions","variance","market",
  "recommendationPrimary","recommendationSecondary","prediction","risk"
];

function publicView(match) {
  if (!match?.premium) return match;
  const copy = { ...match };
  LOCKED_FIELDS.forEach(k => delete copy[k]);
  copy.locked = true;
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
