(function () {
  const matchMap = new Map();
  let refreshing = false;

  const $ = (s, root = document) => root.querySelector(s);

  function norm(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[：﹕]/g, ":")
      .replace(/[＋]/g, "+")
      .replace(/[－−–—]/g, "-")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/\s+/g, "")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function aliases(match, side) {
    const values = side === "A"
      ? [match.teamAShort, match.teamA]
      : [match.teamBShort, match.teamB];
    return [...new Set(values.map(norm).filter(Boolean))].sort((a, b) => b.length - a.length);
  }

  function containsAlias(text, list) {
    return list.some(a => text.includes(a));
  }

  function sideInfo(match, text) {
    const aAliases = aliases(match, "A");
    const bAliases = aliases(match, "B");
    const hasA = containsAlias(text, aAliases);
    const hasB = containsAlias(text, bAliases);
    if (hasA && !hasB) return { side: "A", aliases: aAliases };
    if (hasB && !hasA) return { side: "B", aliases: bAliases };
    return { side: null, aliases: [] };
  }

  function sideScore(side, aScore, bScore) {
    return side === "A" ? aScore : bScore;
  }

  function oppScore(side, aScore, bScore) {
    return side === "A" ? bScore : aScore;
  }

  function chineseNumberToInt(raw) {
    const value = norm(raw);
    const map = {
      "一": 1, "1": 1,
      "兩": 2, "二": 2, "2": 2,
      "三": 3, "3": 3,
      "四": 4, "4": 4,
      "五": 5, "5": 5
    };
    return map[value] ?? null;
  }

  function exactScoreForAlias(match, text, aScore, bScore) {
    for (const side of ["A", "B"]) {
      for (const alias of aliases(match, side)) {
        const re = new RegExp(
          escapeRegExp(alias) +
          "(?:有望)?(?:以)?(\\d+):(\\d+)(?:取勝|獲勝|勝出|拿下|勝)?"
        );
        const m = text.match(re);
        if (!m) continue;
        const predictedSide = Number(m[1]);
        const predictedOpp = Number(m[2]);
        const actualSide = sideScore(side, aScore, bScore);
        const actualOpp = oppScore(side, aScore, bScore);
        return {
          known: true,
          hit: predictedSide === actualSide && predictedOpp === actualOpp,
          reason: `自動判定：${side === "A" ? match.teamAShort : match.teamBShort} ${predictedSide}:${predictedOpp}`
        };
      }
    }
    return null;
  }

  function evaluateTrend(match, aScore, bScore) {
    const original = String(match?.recommendationPrimary || "").trim();
    const text = norm(original);
    if (!text) return { known: false, reason: "未填寫賽事觀點，請手動判定" };

    const total = aScore + bScore;

    // 大小局：大 2.5 / 小 2.5
    let m = text.match(/(大|小)(\d+(?:\.\d+)?)/);
    if (m) {
      const line = Number(m[2]);
      return {
        known: true,
        hit: m[1] === "大" ? total > line : total < line,
        reason: `自動判定：${m[1]} ${line}`
      };
    }

    // 打滿三局 / 打滿五局
    m = text.match(/打滿([一二兩三四五12345])局/);
    if (m) {
      const games = chineseNumberToInt(m[1]);
      if (games) {
        return {
          known: true,
          hit: total === games,
          reason: `自動判定：打滿 ${games} 局`
        };
      }
    }

    // 明確比分：T1 2:0 / T1 有望以 2:0 取勝
    const exact = exactScoreForAlias(match, text, aScore, bScore);
    if (exact) return exact;

    const info = sideInfo(match, text);
    if (!info.side) {
      return { known: false, reason: "無法辨識賽事觀點對應的隊伍，請手動判定" };
    }

    const s = sideScore(info.side, aScore, bScore);
    const o = oppScore(info.side, aScore, bScore);
    const teamName = info.side === "A" ? match.teamAShort : match.teamBShort;

    // 讓分：T1 -1.5 / T1 +1.5
    m = text.match(/([+-]\d+(?:\.\d+)?)/);
    if (m) {
      const handicap = Number(m[1]);
      return {
        known: true,
        hit: s + handicap > o,
        reason: `自動判定：${teamName} ${handicap > 0 ? "+" : ""}${handicap}`
      };
    }

    // 至少拿下 N 局
    m = text.match(/至少(?:可)?(?:拿下|贏下|拿到|取得)([一二兩三四五12345])局/);
    if (!m) m = text.match(/至少([一二兩三四五12345])局/);
    if (m) {
      const need = chineseNumberToInt(m[1]);
      if (need) {
        return {
          known: true,
          hit: s >= need,
          reason: `自動判定：${teamName} 至少拿下 ${need} 局`
        };
      }
    }

    // 不敗（LoL 系列賽無和局，等同系列賽獲勝）
    if (text.includes("不敗")) {
      return {
        known: true,
        hit: s > o,
        reason: `自動判定：${teamName} 不敗`
      };
    }

    // 系列賽勝 / 獲勝 / 勝出 / 取勝
    if (
      /系列賽(?:獲勝|勝出|勝)|(?:獲勝|勝出|取勝)$/.test(text) ||
      text.endsWith("勝")
    ) {
      return {
        known: true,
        hit: s > o,
        reason: `自動判定：${teamName} 系列賽勝負`
      };
    }

    return { known: false, reason: "這個賽事觀點無法只靠最終比分判斷，請手動選擇" };
  }

  function ensureStatus(entry) {
    let el = $(".auto-trend-status", entry);
    if (el) return el;
    const field = $(".result-trend-field", entry);
    if (!field) return null;
    el = document.createElement("small");
    el.className = "auto-trend-status";
    field.appendChild(el);
    return el;
  }

  function setStatus(entry, type, text) {
    const el = ensureStatus(entry);
    if (!el) return;
    el.className = `auto-trend-status ${type || ""}`.trim();
    el.textContent = text;
  }

  function applyAuto(entry, match) {
    if (!entry || !match) return;

    const aInput = $(`[data-score-a="${CSS.escape(match.id)}"]`, entry);
    const bInput = $(`[data-score-b="${CSS.escape(match.id)}"]`, entry);
    const select = $(`[data-trend-hit="${CSS.escape(match.id)}"]`, entry);
    if (!aInput || !bInput || !select) return;

    const aRaw = String(aInput.value ?? "").trim();
    const bRaw = String(bInput.value ?? "").trim();

    if (aRaw === "" || bRaw === "") {
      if (select.dataset.autoApplied === "1") select.value = "";
      select.dataset.autoApplied = "0";
      select.dataset.manualOverride = "0";
      setStatus(entry, "is-waiting", "輸入最終比分後，系統會自動判斷賽事觀點。");
      return;
    }

    const aScore = Number(aRaw);
    const bScore = Number(bRaw);
    if (!Number.isInteger(aScore) || !Number.isInteger(bScore) || aScore < 0 || bScore < 0 || aScore === bScore) {
      setStatus(entry, "is-manual", "比分尚未有效，請確認雙方最終比分。");
      return;
    }

    const result = evaluateTrend(match, aScore, bScore);

    if (!result.known) {
      if (select.dataset.autoApplied === "1") select.value = "";
      select.dataset.autoApplied = "0";
      select.dataset.manualOverride = "0";
      setStatus(entry, "is-manual", `⚠ ${result.reason}`);
      return;
    }

    if (select.dataset.manualOverride !== "1") {
      select.value = result.hit ? "true" : "false";
      select.dataset.autoApplied = "1";
    }

    if (select.dataset.manualOverride === "1") {
      setStatus(entry, "is-override", `已手動覆寫｜${result.reason}`);
    } else {
      setStatus(entry, result.hit ? "is-hit" : "is-miss",
        `${result.hit ? "✅" : "❌"} ${result.reason}，可手動覆寫`);
    }
  }

  function bindEntry(entry) {
    if (!entry || entry.dataset.autoTrendBound === "1") return;
    const aInput = $("[data-score-a]", entry);
    const bInput = $("[data-score-b]", entry);
    const select = $("[data-trend-hit]", entry);
    if (!aInput || !bInput || !select) return;

    const id = aInput.dataset.scoreA;
    const match = matchMap.get(id);
    if (!match) return;

    entry.dataset.autoTrendBound = "1";

    const rec = document.createElement("div");
    rec.className = "auto-trend-preview";
    rec.innerHTML = `<span>賽前觀點</span><strong></strong>`;
    rec.querySelector("strong").textContent = match.recommendationPrimary || "尚未填寫";
    entry.insertBefore(rec, $(".result-trend-field", entry));

    const recalc = () => applyAuto(entry, match);
    aInput.addEventListener("input", () => {
      select.dataset.manualOverride = "0";
      recalc();
    });
    bInput.addEventListener("input", () => {
      select.dataset.manualOverride = "0";
      recalc();
    });

    select.addEventListener("change", (event) => {
      if (event.isTrusted) {
        select.dataset.manualOverride = select.value ? "1" : "0";
        if (select.dataset.manualOverride === "1") {
          setStatus(entry, "is-override", "已使用手動判定；再次修改比分會重新啟用自動判斷。");
        } else {
          recalc();
        }
      }
    });

    recalc();
  }

  function bindAll() {
    document.querySelectorAll(".admin-result-entry").forEach(bindEntry);
  }

  async function refreshMatches() {
    if (refreshing) return;
    refreshing = true;
    try {
      const res = await fetch("/api/admin-matches", {
        method: "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.matches)) {
        matchMap.clear();
        data.matches.forEach(m => matchMap.set(m.id, m));
        bindAll();
      }
    } catch {}
    finally { refreshing = false; }
  }

  function injectStyles() {
    if ($("#kelAutoResultStyles")) return;
    const style = document.createElement("style");
    style.id = "kelAutoResultStyles";
    style.textContent = `
      .auto-trend-preview{
        display:flex;align-items:baseline;gap:7px;
        min-width:170px;padding:0;
        border:0;background:transparent;border-radius:0
      }
      .auto-trend-preview span{font-size:10px;color:#7f96ae;font-weight:800;white-space:nowrap}
      .auto-trend-preview strong{font-size:12px;color:#dceeff;line-height:1.4}
      .auto-trend-status{display:block;margin-top:3px;font-size:11px;line-height:1.4}
      .auto-trend-status.is-waiting{color:#7f96ae}
      .auto-trend-status.is-hit{color:#8ff0b7}
      .auto-trend-status.is-miss{color:#ff9ea7}
      .auto-trend-status.is-manual{color:#ffe28a}
      .auto-trend-status.is-override{color:#83ddff}

      @media(max-width:720px){
        .admin-result-entry{
          column-gap:7px!important;
          row-gap:6px!important;
          padding-top:2px
        }
        .auto-trend-preview{
          grid-column:1/-1;
          width:100%;
          margin-top:2px;
          padding:7px 0 2px;
          border-top:1px solid rgba(255,255,255,.055)
        }
        .result-trend-field{
          gap:3px!important;
          margin-top:0
        }
        .result-trend-field>span{
          margin:0!important
        }
        .result-trend-select{
          min-height:40px
        }
        .admin-result-entry .btn{
          margin-top:2px;
          min-height:44px
        }
        .auto-trend-status{
          margin-top:2px
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initObserver() {
    const root = $("#adminList");
    if (!root || root.dataset.autoResultObserved === "1") return;
    root.dataset.autoResultObserved = "1";
    const observer = new MutationObserver(() => {
      bindAll();
      refreshMatches();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  async function init() {
    injectStyles();
    await refreshMatches();

    const timer = setInterval(() => {
      initObserver();
      bindAll();
      if ($("#adminList")) clearInterval(timer);
    }, 250);

    setTimeout(() => clearInterval(timer), 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
