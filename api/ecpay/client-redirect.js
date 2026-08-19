import { dbReady, getOrder, savePaymentInfo } from "../_lib/db.js";
import { formFields, getEcpayConfig, merchantMatches, requestBaseUrl, verifyCheckMacValue } from "../_lib/ecpay.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).send("METHOD_NOT_ALLOWED");
  const orderNo = String(req.query?.order || "");
  const token = String(req.query?.token || "");
  const fallback = `${requestBaseUrl(req)}/payment-result.html?order=${encodeURIComponent(orderNo)}&token=${encodeURIComponent(token)}`;

  if (req.method === "POST" && dbReady()) {
    try {
      const fields = formFields(req);
      const config = getEcpayConfig();
      if (config.configured && merchantMatches(fields, config.merchantId) && verifyCheckMacValue(fields, config.hashKey, config.hashIV)) {
        const returnedOrderNo = String(fields.MerchantTradeNo || orderNo);
        const order = await getOrder(returnedOrderNo);
        if (order && order.environment === config.mode && Number(fields.TradeAmt || 0) === Number(order.amount)) {
          // ClientRedirectURL 僅補充顯示取號資訊，不作為付款成功依據。
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
