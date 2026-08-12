import { authReady, isAdmin } from "./_lib/auth.js";
import { dbReady } from "./_lib/db.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({
    configured: authReady() && dbReady(),
    authenticated: isAdmin(req),
    authConfigured: authReady(),
    dbConfigured: dbReady()
  });
}
