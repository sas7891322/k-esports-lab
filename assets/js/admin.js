(function () {
  let editId = null;
  let adminMatches = [];
  const $ = (s) => document.querySelector(s);

  function slugify(v) { return String(v || "match").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function val(id) { return $(id)?.value?.trim() || ""; }
  function checked(id) { return !!$(id)?.checked; }

  function selectedTime() {
    const hour = val("#fTimeHour");
    const minute = val("#fTimeMinute") || "00";
    return hour ? `${hour}:${minute}` : "";
  }

  function setTimeControls(time) {
    const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
    const hour = match ? String(Number(match[1])).padStart(2, "0") : "";
    const minute = match && match[2] === "30" ? "30" : "00";
    if ($("#fTimeHour")) $("#fTimeHour").value = hour;
    if ($("#fTimeMinute")) $("#fTimeMinute").value = minute;
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401 && !url.includes("admin-session")) {
        location.replace("admin-login.html");
      }
      const err = new Error(body.error || `HTTP_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  function leagueTeams() {
    return window.KEL_TEAMS?.[val("#fLeague") || "LCK"] || {};
  }

  function fillTeamSelects(selectedA = "", selectedB = "") {
    const teams = leagueTeams();
    const options = Object.values(teams)
      .map(t => `<option value="${window.KEL.escapeHtml(t.short)}">${window.KEL.escapeHtml(t.short)}｜${window.KEL.escapeHtml(t.name)}</option>`)
      .join("");
    ["#fTeamASelect", "#fTeamBSelect"].forEach(sel => {
      const el = $(sel);
      if (el) el.innerHTML = `<option value="">請選擇戰隊</option>${options}`;
    });
    if ($("#fTeamASelect")) $("#fTeamASelect").value = teams[selectedA] ? selectedA : "";
    if ($("#fTeamBSelect")) $("#fTeamBSelect").value = teams[selectedB] ? selectedB : "";
    renderTeamPreviews();
  }

  function selectedTeam(side) {
    const short = val(side === "A" ? "#fTeamASelect" : "#fTeamBSelect");
    return leagueTeams()[short] || null;
  }

  function renderTeamPreview(side) {
    const root = $(side === "A" ? "#fTeamAPreview" : "#fTeamBPreview");
    if (!root) return;
    const team = selectedTeam(side);
    if (!team) {
      root.innerHTML = '<span class="admin-team-empty">尚未選擇</span>';
      return;
    }
    root.innerHTML = `<img src="${team.logo}" alt="${window.KEL.escapeHtml(team.name)}"><span><strong>${window.KEL.escapeHtml(team.short)}</strong><small>${window.KEL.escapeHtml(team.name)}</small></span>`;
  }

  function renderTeamPreviews() {
    renderTeamPreview("A"); renderTeamPreview("B");
  }

  async function checkSession() {
    const access = $("#adminAccessCheck");
    const app = $("#adminApp");

    try {
      const session = await api("/api/admin-session", { method: "GET", headers: {}, cache: "no-store" });
      if (!session.configured || !session.authenticated) {
        location.replace("admin-login.html");
        return false;
      }

      if (access) access.hidden = true;
      if (app) app.hidden = false;
      await loadAdminMatches();
      return true;
    } catch {
      location.replace("admin-login.html");
      return false;
    }
  }

  async function logout() {
    await api("/api/admin-logout", { method: "POST", body: "{}" }).catch(() => {});
    location.replace("admin-login.html");
  }

  async function loadAdminMatches() {
    const data = await api("/api/admin-matches", { method: "GET", headers: {} });
    adminMatches = Array.isArray(data.matches) ? data.matches : [];
    renderList();
  }

  function updatePremiumFields() {
    const premium = checked("#fPremium");
    const fields = $("#premiumFields");
    if (fields) fields.hidden = !premium;
  }

  function extractScore(value) {
    const normalized = String(value || "").trim().replace(/[：﹕]/g, ":");
    const match = normalized.match(/(\d+)\s*:\s*(\d+)/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function predictionHit(prediction, aScore, bScore) {
    const score = extractScore(prediction);
    if (!score) return false;
    return score[0] === Number(aScore) && score[1] === Number(bScore);
  }

  function resultHitForMatch(m) {
    const actual = extractScore(m?.result);
    if (!actual) return !!m?.resultHit;
    return predictionHit(m?.prediction, actual[0], actual[1]);
  }

  function normalizeDirection(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[＋﹢]/g, "+")
      .replace(/[－−﹣]/g, "-")
      .replace(/[：﹕]/g, ":")
      .replace(/\s+/g, "");
  }

  function directionTeamSide(m, direction) {
    const text = normalizeDirection(direction);
    const candidates = [
      ["A", m?.teamAShort, m?.teamA],
      ["B", m?.teamBShort, m?.teamB]
    ];
    for (const [side, short, name] of candidates) {
      const keys = [short, name].map(normalizeDirection).filter(Boolean);
      if (keys.some(key => text.includes(key))) return side;
    }
    return null;
  }

  function trendHit(m, aScore, bScore) {
    const direction = m?.recommendationPrimary;
    if (!direction) return null;

    const text = normalizeDirection(direction);
    const scoreA = Number(aScore);
    const scoreB = Number(bScore);
    const totalGames = scoreA + scoreB;

    // 網站版文字化賽事傾向：系列賽局數判定（不需要指定隊伍）。
    if (text.includes("系列賽有望打滿三局") || text.includes("打滿三局") || text.includes("打滿3局")) return totalGames === 3;
    if (text.includes("系列賽有望打滿五局") || text.includes("打滿五局") || text.includes("打滿5局")) return totalGames === 5;
    if (text.includes("系列賽有望兩局內結束") || text.includes("兩局內結束") || text.includes("2局內結束")) return totalGames <= 2;
    if (text.includes("系列賽有望三局內結束") || text.includes("三局內結束") || text.includes("3局內結束")) return totalGames <= 3;

    const side = directionTeamSide(m, direction);
    if (!side) return null;

    const teamScore = side === "A" ? scoreA : scoreB;
    const opponentScore = side === "A" ? scoreB : scoreA;

    // 新網站固定句型。
    if (text.includes("至少可拿下一局") || text.includes("至少能拿下一局") || text.includes("至少拿下一局")) return teamScore >= 1;
    if (text.includes("至少可拿下兩局") || text.includes("至少能拿下兩局") || text.includes("至少拿下兩局")) return teamScore >= 2;
    if (text.includes("直落二取勝") || text.includes("直落2取勝") || text.includes("直落二勝出")) return teamScore === 2 && opponentScore === 0;
    if (text.includes("至少兩局差取勝") || text.includes("至少2局差取勝") || text.includes("拉開局數差距取勝")) return teamScore > opponentScore && (teamScore - opponentScore) >= 2;
    if (text.includes("系列賽勝出") || text.includes("系列賽獲勝")) return teamScore > opponentScore;

    // 舊資料相容：既有紀錄仍能正確核對；新內容改用文字化賽事傾向。
    const handicap = text.match(/([+-]\d+(?:\.\d+)?)/);
    if (handicap) return teamScore + Number(handicap[1]) > opponentScore;
    if (text.includes("勝") || text.includes("較優") || text.includes("看好") || text.includes("WIN") || text.includes("ML")) return teamScore > opponentScore;
    return null;
  }

  function trendHitForMatch(m) {
    const actual = extractScore(m?.result);
    if (!actual) return typeof m?.trendHit === "boolean" ? m.trendHit : null;
    const calculated = trendHit(m, actual[0], actual[1]);
    return calculated === null ? (typeof m?.trendHit === "boolean" ? m.trendHit : null) : calculated;
  }

  function resultIcon(value) {
    if (value === true) return "✓";
    if (value === false) return "✕";
    return "—";
  }

  function renderResultManager(m) {
    if (m.status === "finished") {
      const scoreHit = resultHitForMatch(m);
      const trendResult = trendHitForMatch(m);
      return `<div class="admin-result-finished">
        <span class="result-badge">已完賽</span>
        <strong>${window.KEL.escapeHtml(m.result || "-")}</strong>
        <span class="${scoreHit ? "result-hit" : "result-miss"}">${resultIcon(scoreHit)} 比分${scoreHit ? "命中" : "未命中"}</span>
        <span class="${trendResult === true ? "result-hit" : "result-miss"}">${resultIcon(trendResult)} 傾向${trendResult === true ? "命中" : trendResult === false ? "未命中" : "待確認"}</span>
        <button class="btn btn-secondary btn-small" data-reopen="${m.id}">重新開啟</button>
      </div>`;
    }
    return `<div class="admin-result-entry">
      <div class="result-team-label">${window.KEL.escapeHtml(m.teamAShort)}</div>
      <input class="input result-score-input" data-score-a="${m.id}" type="number" min="0" max="5" inputmode="numeric" placeholder="0">
      <span class="result-colon">：</span>
      <input class="input result-score-input" data-score-b="${m.id}" type="number" min="0" max="5" inputmode="numeric" placeholder="0">
      <div class="result-team-label">${window.KEL.escapeHtml(m.teamBShort)}</div>
      <button class="btn btn-primary btn-small" data-finish="${m.id}">確認完賽</button>
    </div>`;
  }

  function renderList() {
    const root = $("#adminList");
    const matches = adminMatches.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    root.innerHTML = matches.map(m => `
      <div class="admin-item admin-match-item">
        <div class="admin-match-main">
          <strong>${window.KEL.escapeHtml(m.league)}｜${window.KEL.escapeHtml(m.teamAShort)} vs ${window.KEL.escapeHtml(m.teamBShort)}</strong>
          <small>${window.KEL.fmtDate(m.date)} ${window.KEL.escapeHtml(m.time)}｜${m.premium ? "焦點賽事＋K Premium" : "免費分析"}｜${m.status === "finished" ? "已結束" : "未完賽"}</small>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-secondary" data-edit="${m.id}">編輯</button>
          <button class="btn btn-secondary" data-duplicate="${m.id}">複製</button>
          <button class="btn btn-danger" data-delete="${m.id}">刪除</button>
        </div>
        <div class="admin-result-manager">${renderResultManager(m)}</div>
      </div>`).join("") || '<div class="empty">尚無賽事。</div>';

    root.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => loadMatch(b.dataset.edit)));
    root.querySelectorAll("[data-duplicate]").forEach(b => b.addEventListener("click", () => duplicateMatch(b.dataset.duplicate)));
    root.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteMatch(b.dataset.delete)));
    root.querySelectorAll("[data-finish]").forEach(b => b.addEventListener("click", () => finishMatch(b.dataset.finish)));
    root.querySelectorAll("[data-reopen]").forEach(b => b.addEventListener("click", () => reopenMatch(b.dataset.reopen)));
  }

  async function finishMatch(id) {
    const m = adminMatches.find(x => x.id === id);
    if (!m) return;
    const a = document.querySelector(`[data-score-a="${CSS.escape(id)}"]`);
    const b = document.querySelector(`[data-score-b="${CSS.escape(id)}"]`);
    const aScore = Number(a?.value), bScore = Number(b?.value);
    if (!Number.isInteger(aScore) || !Number.isInteger(bScore) || aScore < 0 || bScore < 0) {
      window.KEL.openModal("比分資料不足", "請先輸入雙方最終比分。"); return;
    }
    if (aScore === bScore) {
      window.KEL.openModal("比分不正確", "系列賽最終比分不能平手。"); return;
    }
    const scoreHit = predictionHit(m.prediction, aScore, bScore);
    const directionHit = trendHit(m, aScore, bScore);
    const updated = {...m,
      status:"finished",
      result:`${m.teamAShort} ${aScore}：${bScore} ${m.teamBShort}`,
      resultHit:scoreHit,
      trendHit:directionHit
    };
    await api("/api/admin-matches", {method:"POST", body:JSON.stringify(updated)});
    await loadAdminMatches();
    const trendText = directionHit === true ? "賽事傾向命中" : directionHit === false ? "賽事傾向未命中" : "賽事傾向請人工確認";
    window.KEL.openModal("已確認完賽", `最終比分 ${updated.result}；預測比分${scoreHit ? "命中" : "未命中"}，${trendText}。`);
  }

  async function reopenMatch(id) {
    const m = adminMatches.find(x => x.id === id);
    if (!m || !confirm("確定要把這場賽事恢復成未完賽嗎？")) return;
    const updated = {...m, status:"upcoming", result:"", resultHit:false, trendHit:null};
    await api("/api/admin-matches", {method:"POST", body:JSON.stringify(updated)});
    await loadAdminMatches();
  }

  function formData() {
    const date = val("#fDate");
    const teamA = selectedTeam("A");
    const teamB = selectedTeam("B");
    const teamAShort = teamA?.short || "";
    const teamBShort = teamB?.short || "";
    const old = editId ? adminMatches.find(x => x.id === editId) : null;
    const premium = checked("#fPremium");
    const id = editId || `${slugify(val("#fLeague"))}-${slugify(teamAShort)}-${slugify(teamBShort)}-${date.replaceAll("-","")}-${Date.now().toString().slice(-5)}`;

    return {
      id,
      league: val("#fLeague") || "LCK",
      date,
      time: selectedTime(),
      bo: val("#fBo") || "BO3",
      teamA: teamA?.name || "",
      teamAShort,
      teamALogo: teamA?.logo || "",
      teamB: teamB?.name || "",
      teamBShort,
      teamBLogo: teamB?.logo || "",

      status: old?.status || "upcoming",

      // 所有場次都保存三個基本欄位；一般場三欄公開，焦點場只公開分析看法。
      preview: val("#fPreview"),
      recommendationPrimary: val("#fPrimary"),
      prediction: val("#fPrediction"),

      premium,
      price: premium ? Number(val("#fPrice") || 39) : 0,
      conditions: premium ? val("#fConditions") : "",
      risk: premium ? val("#fRisk") : "",
      recommendationSecondary: premium ? val("#fSecondary") : "",

      result: old?.result || "",
      resultHit: !!old?.resultHit,
      trendHit: typeof old?.trendHit === "boolean" ? old.trendHit : null
    };
  }

  async function save(e) {
    e.preventDefault();
    const m = formData();
    if (!m.date || !m.teamA || !m.teamB) {
      window.KEL.openModal("資料不足", "至少要選擇日期、A 隊與 B 隊。");
      return;
    }
    if (m.teamAShort === m.teamBShort) {
      window.KEL.openModal("隊伍重複", "A 隊與 B 隊不能選擇同一支戰隊。");
      return;
    }

    try {
      await api("/api/admin-matches", { method: "POST", body: JSON.stringify(m) });
      await loadAdminMatches();
      resetForm();
      window.KEL.openModal("已儲存", "賽事已寫入雲端資料庫，正式網站會讀取同一份資料。");
    } catch (err) {
      window.KEL.openModal("儲存失敗", err.status === 401 ? "登入已失效，請重新登入。" : "請檢查 Vercel 資料庫設定。");
    }
  }

  function loadMatch(id) {
    const m = adminMatches.find(x => x.id === id); if (!m) return;
    editId = id;
    const map = {
      "#fLeague":m.league,
      "#fDate":m.date,
      "#fBo":m.bo,
      "#fPrice":m.price || 39,
      "#fPreview":m.preview,
      "#fConditions":m.conditions,
      "#fRisk":m.risk || m.variance,
      "#fPrimary":m.recommendationPrimary,
      "#fPrediction":m.prediction,
      "#fSecondary":m.recommendationSecondary
    };
    Object.entries(map).forEach(([sel,v]) => { if ($(sel)) $(sel).value = v ?? ""; });
    setTimeControls(m.time);
    fillTeamSelects(m.teamAShort, m.teamBShort);
    $("#fPremium").checked = !!m.premium;
    updatePremiumFields();
    $("#formTitle").textContent = "編輯賽事";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function duplicateMatch(id) {
    const m = adminMatches.find(x => x.id === id); if (!m) return;
    const copy = {...m, id: `${m.id}-copy-${Date.now().toString().slice(-5)}`, status:"upcoming", result:"", resultHit:false, trendHit:null};
    await api("/api/admin-matches", { method:"POST", body:JSON.stringify(copy) });
    await loadAdminMatches();
  }

  async function deleteMatch(id) {
    if (!confirm("確定要刪除這場賽事嗎？")) return;
    await api(`/api/admin-matches?id=${encodeURIComponent(id)}`, { method:"DELETE", body:"{}" });
    await loadAdminMatches();
  }

  function resetForm() {
    editId = null;
    $("#matchForm")?.reset();
    if ($("#fPrice")) $("#fPrice").value = 39;
    setTimeControls("");
    if ($("#formTitle")) $("#formTitle").textContent = "新增賽事";
    updatePremiumFields();
    fillTeamSelects();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#adminTopLogout")?.addEventListener("click", logout);
    $("#adminMobileLogout")?.addEventListener("click", logout);
    $("#adminLogout")?.addEventListener("click", logout);
    $("#matchForm")?.addEventListener("submit", save);
    $("#resetForm")?.addEventListener("click", resetForm);
    $("#fLeague")?.addEventListener("change", () => fillTeamSelects());
    $("#fTeamASelect")?.addEventListener("change", renderTeamPreviews);
    $("#fTeamBSelect")?.addEventListener("change", renderTeamPreviews);
    $("#fPremium")?.addEventListener("change", updatePremiumFields);
    fillTeamSelects();
    checkSession();
  });
})();
