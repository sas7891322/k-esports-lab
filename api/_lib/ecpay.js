import crypto from "node:crypto";

const STAGE = {
  merchantId: "3002607",
  hashKey: "pwFHCqoQZGmho4w6",
  hashIV: "EkRm7iFT261dpevs",
  checkoutUrl: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
};

const PROD_CHECKOUT = "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";

export function getEcpayConfig() {
  const production = String(process.env.ECPAY_ENV || "stage").toLowerCase() === "production";
  if (!production) return { ...STAGE, production: false };

  const merchantId = process.env.ECPAY_MERCHANT_ID || "";
  const hashKey = process.env.ECPAY_HASH_KEY || "";
  const hashIV = process.env.ECPAY_HASH_IV || "";
  return {
    merchantId,
    hashKey,
    hashIV,
    checkoutUrl: PROD_CHECKOUT,
    production: true,
    configured: Boolean(merchantId && hashKey && hashIV)
  };
}

function ecpayUrlEncode(input) {
  // ECPay requires .NET-style urlencode output before SHA256.
  return encodeURIComponent(input)
    .replace(/%20/g, "+")
    .replace(/%2D/gi, "-")
    .replace(/%5F/gi, "_")
    .replace(/%2E/gi, ".")
    .replace(/%21/gi, "!")
    .replace(/%2A/gi, "*")
    .replace(/%28/gi, "(")
    .replace(/%29/gi, ")")
    .toLowerCase();
}

export function createCheckMacValue(fields, hashKey, hashIV) {
  const sorted = Object.entries(fields)
    .filter(([key, value]) => key !== "CheckMacValue" && value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)])
    .sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const raw = `HashKey=${hashKey}&${sorted}&HashIV=${hashIV}`;
  return crypto.createHash("sha256").update(ecpayUrlEncode(raw), "utf8").digest("hex").toUpperCase();
}

export function verifyCheckMacValue(fields, hashKey, hashIV) {
  const actual = String(fields?.CheckMacValue || "").toUpperCase();
  if (!actual) return false;
  const expected = createCheckMacValue(fields, hashKey, hashIV);
  if (actual.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function merchantTradeNo() {
  // ECPay requires 20 chars max, alphanumeric only, and unique per order.
  const time = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return (`K${time}${rand}`).replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

export function clientToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

export function taipeiTradeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function requestBaseUrl(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "k-esports-lab.vercel.app").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function formFields(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
  return Object.fromEntries(new URLSearchParams(raw).entries());
}
