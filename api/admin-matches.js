import webpush from "web-push";
import { isAdmin } from "./_lib/auth.js";
import {
  dbReady,
  listMatches,
  getMatchById,
  upsertMatch,
  deleteMatch,
  listMatchReminders,
  removeMatchReminder,
  clearMatchReminders
} from "./_lib/db.js";

function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

async function notifyPublishedMatch(match) {
  const base = {
    triggered: true,
    configured: pushConfigured(),
    sent: 0,
    failed: 0
  };
  if (!base.configured) return base;

  const reminders = await listMatchReminders(match.id);
  if (!reminders.length) return base;

  const subject = String(process.env.PUBLIC_SITE_URL || "https://k-esports-lab.vercel.app").trim();
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({
    title: "K Esports Lab｜焦點賽事分析已發布",
    body: `${match.teamAShort || "A"} vs ${match.teamBShort || "B"} 的焦點賽事分析已上線。`,
    url: `/match.html?id=${encodeURIComponent(match.id)}`,
    matchId: match.id
  });

  for (const row of reminders) {
    try {
      await webpush.sendNotification(row.subscription, payload, { TTL: 86400 });
      base.sent += 1;
      await removeMatchReminder(match.id, row.endpoint);
    } catch (error) {
      base.failed += 1;
      // 404 / 410 表示瀏覽器推播訂閱已失效，直接清掉避免持續累積。
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await removeMatchReminder(match.id, row.endpoint).catch(() => {});
      } else {
        console.error("Push notification failed", error);
      }
    }
  }
  return base;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
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

      const previous = await getMatchById(match.id);
      const publishTransition = Boolean(
        previous &&
        previous.premium &&
        previous.analysisPublished === false &&
        match.premium &&
        match.analysisPublished !== false
      );

      if (publishTransition && !match.publishedAt) match.publishedAt = new Date().toISOString();
      await upsertMatch(match);

      let reminderNotification = { triggered: false, configured: pushConfigured(), sent: 0, failed: 0 };
      if (publishTransition) {
        reminderNotification = await notifyPublishedMatch(match).catch(error => {
          console.error("Reminder notification batch failed", error);
          return { triggered: true, configured: pushConfigured(), sent: 0, failed: 0, error: true };
        });
      }

      res.status(200).json({ ok: true, match, reminderNotification });
      return;
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        res.status(400).json({ error: "MISSING_ID" });
        return;
      }
      await clearMatchReminders(id).catch(() => {});
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
