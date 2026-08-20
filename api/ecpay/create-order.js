import { dbReady, getMatchById, createOrderRecord } from "../_lib/db.js";
import {
  clientToken,
  createCheckMacValue,
  getEcpayConfig,
  merchantTradeNo,
  requestBaseUrl,
  taipeiTradeDate,
  tokenHash
} from "../_lib/ecpay.js";

const ALLOWED_METHODS = new Set(["ATM", "CVS"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!dbReady()) return res.status(503).json({ error: "DB_NOT_CONFIGURED" });

  try {
    const matchId = String(req.body?.matchId || "").trim();
    const paymentMethod = String(req.body?.paymentMethod || "ATM").toUpperCase();
    if (!matchId || !ALLOWED_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "INVALID_ORDER_REQUEST" });
    }

    const config = getEcpayConfig();
    if (!config.configured) {
      return res.status(503).json({ error: config.mode === "production" ? "ECPAY_PRODUCTION_NOT_CONFIGURED" : "ECPAY_ENV_NOT_CONFIGURED" });
    }

    const match = await getMatchById(matchId);
    if (!match || !match.premium) return res.status(404).json({ error: "PREMIUM_MATCH_NOT_FOUND" });
    if (match.status === "finished") return res.status(409).json({ error: "MATCH_ALREADY_FINISHED" });
    if (match.analysisPublished === false) return res.status(409).json({ error: "ANALYSIS_NOT_PUBLISHED" });

    const amount = Number(match.price || 39);
    if (!Number.isInteger(amount) || amount < 31) {
      return res.status(400).json({ error: "INVALID_PRICE" });
    }

    const orderNo = merchantTradeNo();
    const token = clientToken();
    const base = requestBaseUrl(req);
    const resultUrl = `${base}/payment-result.html?order=${encodeURIComponent(orderNo)}&token=${encodeURIComponent(token)}`;
    const itemLabel = `K Premium ${match.teamAShort || "A"} vs ${match.teamBShort || "B"}`.slice(0, 390);

    await createOrderRecord({
      merchantTradeNo: orderNo,
      matchId,
      amount,
      clientTokenHash: tokenHash(token),
      environment: config.mode
    });

    const params = {
      MerchantID: config.merchantId,
      MerchantTradeNo: orderNo,
      MerchantTradeDate: taipeiTradeDate(),
      PaymentType: "aio",
      TotalAmount: amount,
      TradeDesc: "K Premium esports analysis",
      ItemName: itemLabel,
      ReturnURL: `${base}/api/ecpay/return`,
      ChoosePayment: paymentMethod,
      EncryptType: 1,
      ClientBackURL: resultUrl,
      PaymentInfoURL: `${base}/api/ecpay/payment-info`,
      ClientRedirectURL: `${base}/api/ecpay/client-redirect?order=${encodeURIComponent(orderNo)}&token=${encodeURIComponent(token)}`,
      NeedExtraPaidInfo: "N"
    };

    if (paymentMethod === "ATM") params.ExpireDate = 1;
    if (paymentMethod === "CVS") params.StoreExpireDate = 1440;

    params.CheckMacValue = createCheckMacValue(params, config.hashKey, config.hashIV);

    return res.status(200).json({
      ok: true,
      mode: config.mode,
      action: config.checkoutUrl,
      params,
      orderNo,
      token,
      resultUrl
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "CREATE_ORDER_FAILED" });
  }
}
