import { dbReady, getOrder, markOrderFromEcpay, recordEcpayReturn } from "../_lib/db.js";
import {
  formFields,
  getEcpayConfig,
  isActualPaidNotification,
  isSimulatedPayment,
  merchantMatches,
  verifyCheckMacValue
} from "../_lib/ecpay.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).send("METHOD_NOT_ALLOWED");
  if (!dbReady()) return res.status(503).send("DB_NOT_CONFIGURED");

  try {
    const fields = formFields(req);
    const config = getEcpayConfig();
    if (!config.configured) return res.status(503).send("ECPAY_NOT_CONFIGURED");
    if (!merchantMatches(fields, config.merchantId)) return res.status(400).send("MERCHANT_MISMATCH");
    if (!verifyCheckMacValue(fields, config.hashKey, config.hashIV)) return res.status(400).send("CHECK_MAC_FAILED");

    const orderNo = String(fields.MerchantTradeNo || "");
    const order = await getOrder(orderNo);
    if (!order) return res.status(404).send("ORDER_NOT_FOUND");
    if (order.environment !== config.mode) return res.status(409).send("ORDER_ENV_MISMATCH");
    if (Number(fields.TradeAmt || 0) !== Number(order.amount)) return res.status(400).send("AMOUNT_MISMATCH");

    // 綠界官方定義：SimulatePaid=1 僅用於驗證 ReturnURL，並非真實付款。
    // 無論 STAGE 或 production 都不可因此把訂單改成 paid 或交付內容。
    if (isSimulatedPayment(fields)) {
      await recordEcpayReturn(orderNo, fields);
      return res.status(200).send("1|OK");
    }

    if (isActualPaidNotification(fields)) {
      await markOrderFromEcpay(orderNo, fields);
    } else {
      await recordEcpayReturn(orderNo, fields);
    }

    // 1|OK 僅代表本站已正確收到通知，避免綠界重送。
    return res.status(200).send("1|OK");
  } catch (error) {
    console.error(error);
    return res.status(500).send("SERVER_ERROR");
  }
}
