-- Run schema.sql first.
-- Formal master v2.3 sample seed. Production deploy does not run this automatically.
INSERT INTO matches (id, data) VALUES
(
  'lck-dns-ns-20260812',
  $${
    "id":"lck-dns-ns-20260812","league":"LCK","week":"第12週","date":"2026-08-12","time":"16:00","bo":"BO3",
    "teamA":"DN SOOPers","teamAShort":"DNS","teamALogo":"assets/img/teams/lck/dns.png",
    "teamB":"Nongshim RedForce","teamBShort":"NS","teamBLogo":"assets/img/teams/lck/ns.png",
    "status":"upcoming","premium":false,"price":0,
    "preview":"這場我會把 DN SOOPers 放在小幅優勢方。關鍵不是單純看長期戰績，而是近期狀態與直接交手內容。",
    "recommendationPrimary":"DN SOOPers 系列賽勝",
    "prediction":"DNS 2：1 NS",
    "result":"","resultHit":false,"trendHit":null
  }$$::jsonb
),
(
  'lck-gen-hle-20260813',
  $${
    "id":"lck-gen-hle-20260813","league":"LCK","week":"第12週","date":"2026-08-13","time":"18:00","bo":"BO3",
    "teamA":"Gen.G Esports","teamAShort":"GEN","teamALogo":"assets/img/teams/lck/gen.png",
    "teamB":"Hanwha Life Esports","teamBShort":"HLE","teamBLogo":"assets/img/teams/lck/hle.png",
    "status":"upcoming","premium":true,"price":39,
    "preview":"GEN vs HLE 是本週最值得拆解的強強對話之一。分析看法公開，完整結論於解鎖後提供。",
    "recommendationPrimary":"待解鎖",
    "prediction":"待解鎖",
    "conditions":"K Premium 完整內容",
    "risk":"K Premium 完整內容",
    "keyPoint":"K Premium 完整內容",
    "result":"","resultHit":false,"trendHit":null
  }$$::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
