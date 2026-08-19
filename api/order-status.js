import { dbReady, getOrder, markStageOrderUnlocked } from "./_lib/db.js";
import { getEcpayConfig, tokenMatches } from "./_lib/ecpay.js";

async function getOrderStatus(req, res) {
  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  if (!orderNo || !token) return res.status(400).json({ error: "MISSING_ORDER_ACCESS" });

  const order = await getOrder(orderNo);
  if (!order || !tokenMatches(token, order.client_token_hash)) {
    return res.status(404).json({ error: "ORDER_NOT_FOUND" });
  }

  const raw = order.raw_result && typeof order.raw_result === "object" ? order.raw_result : {};
  const simulationVerified =
    order.environment === "stage" &&
    String(raw.SimulatePaid || "") === "1" &&
    String(raw.RtnCode || "") === "1";

  return res.status(200).json({
    orderNo: order.merchant_trade_no,
    matchId: order.match_id,
    amount: order.amount,
    status: order.status,
    environment: order.environment,
    paymentType: order.payment_type || "",
    paymentInfo: order.payment_info || {},
    paidAt: order.paid_at || null,
    simulationVerified
  });
}

async function stageUnlock(req, res) {
  const config = getEcpayConfig();

  // Hard stop: production can never use the STAGE unlock action.
  if (config.mode !== "stage") return res.status(404).json({ error: "NOT_AVAILABLE" });

  const action = String(req.body?.action || "");
  if (action !== "stage_unlock") return res.status(400).json({ error: "INVALID_ACTION" });

  const orderNo = String(req.body?.order || "");
  const token = String(req.body?.token || "");
  if (!orderNo || !token) return res.status(400).json({ error: "MISSING_ORDER_ACCESS" });

  const order = await getOrder(orderNo);
  if (!order || order.environment !== "stage" || !tokenMatches(token, order.client_token_hash)) {
    return res.status(404).json({ error: "ORDER_NOT_FOUND" });
  }

  if (order.status === "paid" || order.status === "stage_paid") {
    return res.status(200).json({ ok: true, status: order.status });
  }

  const raw = order.raw_result && typeof order.raw_result === "object" ? order.raw_result : {};
  const simulationVerified =
    String(raw.SimulatePaid || "") === "1" && String(raw.RtnCode || "") === "1";

  if (!simulationVerified) {
    return res.status(409).json({ error: "STAGE_CALLBACK_NOT_VERIFIED" });
  }

  await markStageOrderUnlocked(orderNo);
  return res.status(200).json({ ok: true, status: "stage_paid" });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!dbReady()) return res.status(503).json({ error: "DB_NOT_CONFIGURED" });

  try {
    if (req.method === "GET") return await getOrderStatus(req, res);
    if (req.method === "POST") return await stageUnlock(req, res);
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: req.method === "POST" ? "STAGE_UNLOCK_FAILED" : "ORDER_STATUS_FAILED"
    });
  }
}
