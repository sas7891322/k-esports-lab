import { dbReady, getMatchById, getOrder } from "./_lib/db.js";
import { getEcpayConfig, tokenMatches } from "./_lib/ecpay.js";

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
    if (!order || order.match_id !== matchId || !tokenMatches(token, order.client_token_hash)) {
      return res.status(403).json({ error: "NOT_UNLOCKED" });
    }

    const config = getEcpayConfig();
    const raw = order.raw_result && typeof order.raw_result === "object" ? order.raw_result : {};
    // 即使是 legacy 資料，只要來源是 SimulatePaid=1 就永遠不能視為真實付款。
    const actualPaid = order.status === "paid" && String(raw.SimulatePaid || "") !== "1";
    const stagePaid = order.status === "stage_paid" && order.environment === "stage" && config.mode === "stage";
    if (!actualPaid && !stagePaid) return res.status(403).json({ error: "NOT_UNLOCKED" });

    const match = await getMatchById(matchId);
    if (!match || !match.premium) return res.status(404).json({ error: "PREMIUM_MATCH_NOT_FOUND" });
    if (match.analysisPublished === false && match.status !== "finished") {
      return res.status(409).json({ error: "ANALYSIS_NOT_PUBLISHED" });
    }

    return res.status(200).json({
      matchId,
      unlocked: true,
      testMode: stagePaid,
      content: {
        conditions: match.conditions || "",
        risk: match.risk || "",
        keyPoint: match.keyPoint || match.matchup || "",
        recommendationPrimary: match.recommendationPrimary || "",
        prediction: match.prediction || ""
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "PREMIUM_CONTENT_FAILED" });
  }
}
