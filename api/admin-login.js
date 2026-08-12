import { authReady, validPassword, makeSessionCookie } from "./_lib/auth.js";
import { dbReady } from "./_lib/db.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }
  if (!authReady() || !dbReady()) {
    res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
    return;
  }
  if (!validPassword(req.body?.password)) {
    res.status(401).json({ error: "INVALID_PASSWORD" });
    return;
  }
  res.setHeader("Set-Cookie", makeSessionCookie());
  res.status(200).json({ ok: true });
}
