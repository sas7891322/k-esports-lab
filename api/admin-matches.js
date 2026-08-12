import { isAdmin } from "./_lib/auth.js";
import { dbReady, listMatches, upsertMatch, deleteMatch } from "./_lib/db.js";

export default async function handler(req, res) {
  if (!dbReady()) {
    res.status(503).json({ error: "DB_NOT_CONFIGURED" });
    return;
  }
  if (!isAdmin(req)) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  try {
    if (req.method === "GET") {
      const matches = await listMatches();
      res.status(200).json({ matches });
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      const match = req.body;
      if (!match?.id || !match?.league || !match?.teamA || !match?.teamB || !match?.date) {
        res.status(400).json({ error: "INVALID_MATCH" });
        return;
      }
      await upsertMatch(match);
      res.status(200).json({ ok: true, match });
      return;
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: "MISSING_ID" });
        return;
      }
      await deleteMatch(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ADMIN_MATCHES_FAILED" });
  }
}
