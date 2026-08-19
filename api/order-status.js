import { dbReady, getOrder } from "./_lib/db.js";
import { tokenMatches } from "./_lib/ecpay.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!dbReady()) return res.status(503).json({ error: "DB_NOT_CONFIGURED" });

  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  if (!orderNo || !token) return res.status(400).json({ error: "MISSING_ORDER_ACCESS" });

  try {
    const order = await getOrder(orderNo);
    if (!order || !tokenMatches(token, order.client_token_hash)) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    const raw = order.raw_result && typeof order.raw_result === "object" ? order.raw_result : {};
    const simulationVerified = order.environment === "stage" && String(raw.SimulatePaid || "") === "1" && String(raw.RtnCode || "") === "1";
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "ORDER_STATUS_FAILED" });
  }
}
