import {
  dbReady,
  listMatches,
  getMatchById,
  upsertMatchReminder,
  removeMatchReminder,
  countMatchReminders,
  listMatchReminderCounts
} from "./_lib/db.js";

const PREMIUM_DEEP_FIELDS = [
  "recent",
  "matchup",
  "bp",
  "conditions",
  "variance",
  "risk",
  "keyPoint",
  "market",
  "recommendationSecondary"
];

function publicView(match) {
  if (!match?.premium) return match;
  const copy = { ...match };
  PREMIUM_DEEP_FIELDS.forEach(k => delete copy[k]);

  // 焦點賽事預告：只公開賽事基本資訊，不公開任何分析內容，也不開放購買。
  if (match.analysisPublished === false && match.status !== "finished") {
    delete copy.preview;
    delete copy.recommendationPrimary;
    delete copy.prediction;
    copy.announcement = true;
    copy.locked = false;
    return copy;
  }

  // 賽前：賽事觀點與預測比分維持鎖定。
  // 賽後：只公開原預測結論與最終賽果，深度分析內容仍不公開。
  if (match.status !== "finished") {
    delete copy.recommendationPrimary;
    delete copy.prediction;
  }
  copy.locked = match.status !== "finished";
  return copy;
}

function validSubscription(subscription) {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  return endpoint.startsWith("https://") && endpoint.length < 4096 && p256dh.length > 20 && auth.length > 5;
}

export default async function handler(req, res) {
  if (!dbReady()) {
    res.status(503).json({ error: "DB_NOT_CONFIGURED" });
    return;
  }

  try {
    if (req.method === "GET") {
      const [matches, reminderCounts] = await Promise.all([
        listMatches(),
        listMatchReminderCounts()
      ]);
      const pushPublicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      res.status(200).json({
        matches: matches.map(match => publicView({
          ...match,
          reminderCount: Number(reminderCounts[match.id] || 0)
        })),
        pushEnabled: Boolean(pushPublicKey && process.env.VAPID_PRIVATE_KEY),
        pushPublicKey
      });
      return;
    }

    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      const action = String(req.body?.action || "");
      const matchId = String(req.body?.matchId || "").trim();
      if (!matchId) {
        res.status(400).json({ error: "MISSING_MATCH_ID" });
        return;
      }

      const match = await getMatchById(matchId);
      if (!match || !match.premium || match.status === "finished" || match.analysisPublished !== false) {
        res.status(409).json({ error: "REMINDER_NOT_AVAILABLE" });
        return;
      }

      if (action === "subscribeReminder") {
        const subscription = req.body?.subscription;
        if (!validSubscription(subscription)) {
          res.status(400).json({ error: "INVALID_PUSH_SUBSCRIPTION" });
          return;
        }
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
          res.status(503).json({ error: "PUSH_NOT_CONFIGURED" });
          return;
        }
        await upsertMatchReminder(matchId, subscription);
        const reminderCount = await countMatchReminders(matchId);
        res.status(200).json({ ok: true, subscribed: true, reminderCount });
        return;
      }

      if (action === "unsubscribeReminder") {
        const endpoint = String(req.body?.endpoint || "");
        if (!endpoint.startsWith("https://")) {
          res.status(400).json({ error: "INVALID_ENDPOINT" });
          return;
        }
        await removeMatchReminder(matchId, endpoint);
        const reminderCount = await countMatchReminders(matchId);
        res.status(200).json({ ok: true, subscribed: false, reminderCount });
        return;
      }

      res.status(400).json({ error: "INVALID_ACTION" });
      return;
    }

    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "MATCHES_READ_FAILED" });
  }
}
