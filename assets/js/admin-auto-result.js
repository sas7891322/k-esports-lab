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

  function parseScoreForMatch(value, match) {
    const text = norm(value);
    const score = text.match(/(\d+):(\d+)/);
    if (!score) return null;

    let first = Number(score[1]);
    let second = Number(score[2]);
    if (!Number.isInteger(first) || !Number.isInteger(second)) return null;

    const before = text.slice(0, score.index);
    const after = text.slice(score.index + score[0].length);
    const aAliases = aliases(match, "A");
    const bAliases = aliases(match, "B");

    const beforeA = containsAlias(before, aAliases);
    const beforeB = containsAlias(before, bAliases);
    const afterA = containsAlias(after, aAliases);
    const afterB = containsAlias(after, bAliases);

    // 若文字是「B隊 1:3 A隊」，轉回資料欄位的 A:B 順序。
    if (beforeB && afterA && !(beforeA && afterB)) {
      return { a: second, b: first };
    }

    // 一般格式「A隊 3:1 B隊」或單純「3:1」皆視為 A:B。
    return { a: first, b: second };
  }

  function predictionScoreHit(match, aScore, bScore) {
    const parsed = parseScoreForMatch(match?.prediction, match);
    if (!parsed) return null;
    return parsed.a === Number(aScore) && parsed.b === Number(bScore);
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

  let finishCaptureBound = false;
  let historicalScoreRepairDone = false;

  async function postMatchUpdate(match) {
    const res = await fetch("/api/admin-matches", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(match)
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
    return data;
  }

  async function finishMatchWithFixedScore(button) {
    const id = String(button?.dataset?.finish || "");
    let match = matchMap.get(id);

    if (!match) {
      await refreshMatches();
      match = matchMap.get(id);
    }
    if (!match) {
      window.KEL?.openModal?.("找不到賽事", "請重新整理後台後再試一次。");
      return;
    }

    const entry = button.closest(".admin-result-entry");
    const aInput = entry?.querySelector(`[data-score-a="${CSS.escape(id)}"]`);
    const bInput = entry?.querySelector(`[data-score-b="${CSS.escape(id)}"]`);
    const trendSelect = entry?.querySelector(`[data-trend-hit="${CSS.escape(id)}"]`);

    const aRaw = String(aInput?.value ?? "").trim();
    const bRaw = String(bInput?.value ?? "").trim();
    const aScore = Number(aRaw);
    const bScore = Number(bRaw);

    if (
      aRaw === "" || bRaw === "" ||
      !Number.isInteger(aScore) || !Number.isInteger(bScore) ||
      aScore < 0 || bScore < 0
    ) {
      window.KEL?.openModal?.("比分資料不足", "請先輸入雙方最終比分。");
      return;
    }
    if (aScore === bScore) {
      window.KEL?.openModal?.("比分不正確", "系列賽最終比分不能平手。");
      return;
    }
    if (!trendSelect?.value) {
      window.KEL?.openModal?.("尚未標記賽事觀點", "若系統無法自動判定，請手動選擇本場賽事觀點是否符合分析。");
      return;
    }

    const scoreHit = predictionScoreHit(match, aScore, bScore);
    const updated = {
      ...match,
      status: "finished",
      result: `${match.teamAShort} ${aScore}：${bScore} ${match.teamBShort}`,
      resultHit: scoreHit === true,
      trendHit: trendSelect.value === "true"
    };

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = "儲存賽果中…";

    try {
      await postMatchUpdate(updated);
      matchMap.set(id, updated);
      window.KEL?.openModal?.(
        "已確認完賽",
        `最終比分 ${updated.result}；預測比分 ${updated.resultHit ? "命中" : "未命中"}，賽事觀點 ${updated.trendHit ? "符合" : "未符合"}。`
      );
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      button.textContent = oldText;
      window.KEL?.openModal?.("儲存失敗", error?.message || "請稍後再試。");
    }
  }

  function bindFinishCapture() {
    if (finishCaptureBound) return;
    finishCaptureBound = true;

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-finish]");
      if (!button) return;

      // 攔截舊版 admin.js 的判定，改用可辨識「TSW 3：1 GAM」的新版邏輯。
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      finishMatchWithFixedScore(button);
    }, true);
  }

  async function repairHistoricalScoreHits() {
    if (historicalScoreRepairDone) return;
    historicalScoreRepairDone = true;

    let changed = false;
    for (const match of [...matchMap.values()]) {
      if (match?.status !== "finished") continue;

      const actual = parseScoreForMatch(match.result, match);
      const predicted = parseScoreForMatch(match.prediction, match);
      if (!actual || !predicted) continue;

      const correctHit = predicted.a === actual.a && predicted.b === actual.b;
      if (match.resultHit === correctHit) continue;

      const updated = { ...match, resultHit: correctHit };
      try {
        await postMatchUpdate(updated);
        matchMap.set(match.id, updated);
        changed = true;
      } catch (error) {
        console.warn("Unable to repair historical resultHit", match.id, error);
      }
    }

    if (changed) {
      // 讓後台顯示修正後的 ✅ / ❌。
      await refreshMatches();
    }
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
    bindFinishCapture();
    await refreshMatches();
    await repairHistoricalScoreHits();

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


/* v2.5.3 Admin traffic summary */
(function () {
  function num(value) {
    return Number(value || 0).toLocaleString("zh-TW");
  }

  function injectTrafficStyles() {
    if (document.querySelector("#kelTrafficAdminStyles")) return;
    const style = document.createElement("style");
    style.id = "kelTrafficAdminStyles";
    style.textContent = `
      .traffic-summary-card{padding:17px 18px}
      .traffic-summary-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:12px}
      .traffic-summary-head h2{margin:3px 0 0;font-size:19px}
      .traffic-summary-head small{color:var(--muted);font-size:11px}
      .traffic-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      .traffic-stat{padding:12px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.02)}
      .traffic-stat span{display:block;color:var(--muted);font-size:11px;font-weight:800}
      .traffic-stat strong{display:block;margin-top:4px;font-size:24px;line-height:1.15;color:#e9f4ff}
      .traffic-seven-day{margin-top:10px;color:#8da5be;font-size:11px;line-height:1.5}
      @media(max-width:720px){
        .traffic-summary-card{padding:14px}
        .traffic-summary-head{align-items:start;flex-direction:column;gap:3px}
        .traffic-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
        .traffic-stat{padding:10px 11px}
        .traffic-stat strong{font-size:22px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTrafficCard() {
    let card = document.querySelector("#trafficSummaryCard");
    if (card) return card;

    const main = document.querySelector("#adminApp .admin-main");
    if (!main) return null;

    card = document.createElement("section");
    card.id = "trafficSummaryCard";
    card.className = "card traffic-summary-card";
    card.innerHTML = `
      <div class="traffic-summary-head">
        <div><div class="eyebrow">SITE TRAFFIC</div><h2>網站流量</h2></div>
        <small>從此功能上線後開始累積</small>
      </div>
      <div class="traffic-stat-grid">
        <div class="traffic-stat"><span>今日訪客</span><strong data-traffic="todayVisitors">—</strong></div>
        <div class="traffic-stat"><span>今日瀏覽</span><strong data-traffic="todayViews">—</strong></div>
        <div class="traffic-stat"><span>累積訪客</span><strong data-traffic="totalVisitors">—</strong></div>
        <div class="traffic-stat"><span>累積瀏覽</span><strong data-traffic="totalViews">—</strong></div>
      </div>
      <div class="traffic-seven-day" data-traffic-seven>最近 7 天：讀取中…</div>
    `;
    main.insertBefore(card, main.firstElementChild);
    return card;
  }

  function renderTraffic(traffic) {
    const card = ensureTrafficCard();
    if (!card) return;
    ["todayVisitors","todayViews","totalVisitors","totalViews"].forEach(key => {
      const el = card.querySelector(`[data-traffic="${key}"]`);
      if (el) el.textContent = num(traffic?.[key]);
    });
    const seven = card.querySelector("[data-traffic-seven]");
    if (seven) {
      seven.textContent = `最近 7 天：${num(traffic?.sevenDayVisitors)} 位訪客・${num(traffic?.sevenDayViews)} 次瀏覽`;
    }
  }

  async function loadTraffic() {
    try {
      const res = await fetch("/api/admin-matches", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (!res.ok) return;
      const data = await res.json();
      renderTraffic(data.traffic || {});
    } catch {}
  }

  function init() {
    injectTrafficStyles();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (ensureTrafficCard()) {
        clearInterval(timer);
        loadTraffic();
      } else if (tries > 40) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
