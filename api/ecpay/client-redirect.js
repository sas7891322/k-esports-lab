import { dbReady, getOrder, savePaymentInfo } from "../_lib/db.js";
import { formFields, getEcpayConfig, requestBaseUrl, verifyCheckMacValue } from "../_lib/ecpay.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).send("METHOD_NOT_ALLOWED");
  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  const fallback = `${requestBaseUrl(req)}/payment-result.html?order=${encodeURIComponent(orderNo)}&token=${encodeURIComponent(token)}`;

  if (req.method === "POST" && dbReady()) {
    try {
      const fields = formFields(req);
      const config = getEcpayConfig();
      if ((!config.production || config.configured) && verifyCheckMacValue(fields, config.hashKey, config.hashIV)) {
        const returnedOrderNo = String(fields.MerchantTradeNo || orderNo);
        const order = await getOrder(returnedOrderNo);
        if (order && Number(fields.TradeAmt || 0) === Number(order.amount)) {
          await savePaymentInfo(returnedOrderNo, fields);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  res.statusCode = 303;
  res.setHeader("Location", fallback);
  res.end();
}
