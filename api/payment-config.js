import { dbReady } from "./_lib/db.js";
import { getEcpayConfig } from "./_lib/ecpay.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  const config = getEcpayConfig();
  const enabled = dbReady() && (!config.production || config.configured);
  return res.status(200).json({
    enabled,
    mode: config.production ? "production" : "stage",
    methods: ["ATM", "CVS"]
  });
}
