import { authReady, isAdmin } from "./_lib/auth.js";
import { dbReady } from "./_lib/db.js";

export default function handler(req, res) {
  res.status(200).json({
    configured: authReady() && dbReady(),
    authenticated: isAdmin(req),
    authConfigured: authReady(),
    dbConfigured: dbReady()
  });
}
