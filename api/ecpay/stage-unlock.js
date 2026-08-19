import { dbReady, getOrder, markStageOrderUnlocked } from "../_lib/db.js";
import { getEcpayConfig, tokenMatches } from "../_lib/ecpay.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!dbReady()) return res.status(503).json({ error: "DB_NOT_CONFIGURED" });

  const config = getEcpayConfig();
  // Hard stop: this endpoint can never unlock production orders.
  if (config.mode !== "stage") return res.status(404).json({ error: "NOT_AVAILABLE" });

  const orderNo = String(req.body?.order || "");
  const token = String(req.body?.token || "");
  if (!orderNo || !token) return res.status(400).json({ error: "MISSING_ORDER_ACCESS" });

  try {
    const order = await getOrder(orderNo);
    if (!order || order.environment !== "stage" || !tokenMatches(token, order.client_token_hash)) {
      return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    }

    if (order.status === "paid" || order.status === "stage_paid") {
      return res.status(200).json({ ok: true, status: order.status });
    }

    const raw = order.raw_result && typeof order.raw_result === "object" ? order.raw_result : {};
    const simulationVerified = String(raw.SimulatePaid || "") === "1" && String(raw.RtnCode || "") === "1";
    if (!simulationVerified) return res.status(409).json({ error: "STAGE_CALLBACK_NOT_VERIFIED" });

    await markStageOrderUnlocked(orderNo);
    return res.status(200).json({ ok: true, status: "stage_paid" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "STAGE_UNLOCK_FAILED" });
  }
}
