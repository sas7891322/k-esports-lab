-- Run schema.sql first.
-- This seed keeps the two existing launch matches in the cloud database.
INSERT INTO matches (id, data) VALUES
(
  'lck-dns-ns-20260812',
  $${
    "id":"lck-dns-ns-20260812","league":"LCK","week":"第12週","date":"2026-08-12","time":"16:00","bo":"BO3",
    "teamA":"DN SOOPers","teamAShort":"DNS","teamALogo":"assets/img/teams/lck/dns.png",
    "teamB":"Nongshim RedForce","teamBShort":"NS","teamBLogo":"assets/img/teams/lck/ns.png",
    "status":"upcoming","premium":false,"price":39,
    "summary":"DNS 剛在 8/8 以 2：0 擊敗 NS，短期直接對戰優勢明確；本場重點在 NS 能否於四天內完成針對性修正。",
    "preview":"這場我會把 DN SOOPers 放在小幅優勢方。關鍵不是單純看長期戰績，而是近期狀態與直接交手內容：DNS 在 8/8 才剛以 2：0 擊敗 NS。",
    "recommendationPrimary":"DN SOOPers 系列賽勝","prediction":"DNS 2：1 NS"
  }$$::jsonb
),
(
  'lck-gen-hle-20260813',
  $${
    "id":"lck-gen-hle-20260813","league":"LCK","week":"第12週","date":"2026-08-13","time":"18:00","bo":"BO3",
    "teamA":"Gen.G Esports","teamAShort":"GEN","teamALogo":"assets/img/teams/lck/gen.png",
    "teamB":"Hanwha Life Esports","teamBShort":"HLE","teamBLogo":"assets/img/teams/lck/hle.png",
    "status":"upcoming","premium":true,"price":39,
    "summary":"Legend Group 前段焦點戰，適合作為 K Premium 精選場。",
    "preview":"GEN vs HLE 是本週最值得拆解的強強對話之一。免費區保留核心判讀，完整研究內容於解鎖後提供。",
    "recommendationPrimary":"待正式解鎖後顯示","prediction":"待解鎖",
    "conditions":"K Premium 完整內容","risk":"強強對話單局波動與 BP 博弈較高。",
    "keyPoint":"首局前十五分鐘、第一輪大型物件與第二局 BP 修正。"
  }$$::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
