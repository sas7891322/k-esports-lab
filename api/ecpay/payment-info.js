import { dbReady, getOrder, savePaymentInfo } from "../_lib/db.js";
import { formFields, getEcpayConfig, verifyCheckMacValue } from "../_lib/ecpay.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("METHOD_NOT_ALLOWED");
  if (!dbReady()) return res.status(503).send("DB_NOT_CONFIGURED");
  try {
    const fields = formFields(req);
    const config = getEcpayConfig();
    if (config.production && !config.configured) return res.status(503).send("ECPAY_NOT_CONFIGURED");
    if (!verifyCheckMacValue(fields, config.hashKey, config.hashIV)) return res.status(400).send("CHECK_MAC_FAILED");
    const orderNo = String(fields.MerchantTradeNo || "");
    const order = await getOrder(orderNo);
    if (!order) return res.status(404).send("ORDER_NOT_FOUND");
    if (Number(fields.TradeAmt || 0) !== Number(order.amount)) return res.status(400).send("AMOUNT_MISMATCH");
    await savePaymentInfo(orderNo, fields);
    return res.status(200).send("1|OK");
  } catch (error) {
    console.error(error);
    return res.status(500).send("SERVER_ERROR");
  }
}
