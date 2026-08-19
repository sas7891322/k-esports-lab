import crypto from "node:crypto";
import { dbReady, getMatchById, getOrder } from "./_lib/db.js";
import { tokenHash } from "./_lib/ecpay.js";

function tokenMatches(given, expectedHash) {
  const hash = tokenHash(given);
  if (!expectedHash || hash.length !== expectedHash.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash)); }
  catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!dbReady()) return res.status(503).json({ error: "DB_NOT_CONFIGURED" });

  const matchId = String(req.query?.matchId || "");
  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  if (!matchId || !orderNo || !token) return res.status(400).json({ error: "MISSING_UNLOCK_ACCESS" });

  try {
    const order = await getOrder(orderNo);
    if (!order || order.match_id !== matchId || order.status !== "paid" || !tokenMatches(token, order.client_token_hash)) {
      return res.status(403).json({ error: "NOT_UNLOCKED" });
    }
    const match = await getMatchById(matchId);
    if (!match || !match.premium) return res.status(404).json({ error: "PREMIUM_MATCH_NOT_FOUND" });

    return res.status(200).json({
      matchId,
      unlocked: true,
      content: {
        recent: match.recent || "",
        matchup: match.matchup || "",
        bp: match.bp || "",
        conditions: match.conditions || "",
        risk: match.risk || "",
        recommendationPrimary: match.recommendationPrimary || "",
        prediction: match.prediction || ""
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "PREMIUM_CONTENT_FAILED" });
  }
}
