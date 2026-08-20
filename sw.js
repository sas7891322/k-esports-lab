self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || "焦點賽事分析已發布。" }; }
  const title = data.title || "K Esports Lab";
  const options = {
    body: data.body || "你設定提醒的焦點賽事分析已發布。",
    icon: "/assets/img/k-logo.svg",
    badge: "/assets/img/k-logo.svg",
    tag: data.matchId ? `kel-match-${data.matchId}` : "kel-match-reminder",
    renotify: true,
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === target && "focus" in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
