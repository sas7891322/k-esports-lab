import crypto from "node:crypto";
import { dbReady, getOrder } from "./_lib/db.js";
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

  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  if (!orderNo || !token) return res.status(400).json({ error: "MISSING_ORDER_ACCESS" });

  try {
    const order = await getOrder(orderNo);
    if (!order || !tokenMatches(token, order.client_token_hash)) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    return res.status(200).json({
      orderNo: order.merchant_trade_no,
      matchId: order.match_id,
      amount: order.amount,
      status: order.status,
      paymentType: order.payment_type || "",
      paymentInfo: order.payment_info || {},
      paidAt: order.paid_at || null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "ORDER_STATUS_FAILED" });
  }
}
