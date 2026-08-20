(function () {
  let editId = null;
  let adminMatches = [];
  const $ = (s) => document.querySelector(s);

  function slugify(v) { return String(v || "match").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function val(id) { return $(id)?.value?.trim() || ""; }
  function checked(id) { return !!$(id)?.checked; }

  function buildMobileTimeOptions() {
    const hour = $("#fTimeHour");
    if (hour && !hour.options.length) {
      hour.innerHTML = Array.from({ length: 24 }, (_, i) => {
        const v = String(i).padStart(2, "0");
        return `<option value="${v}">${v}</option>`;
      }).join("");
    }
  }

  function setScheduledTime(value = "") {
    const normalized = /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : "";
    if ($("#fTime")) $("#fTime").value = normalized;
    buildMobileTimeOptions();
    const [h = "00", rawMinute = "00"] = normalized ? normalized.split(":") : ["00", "00"];
    if ($("#fTimeHour")) $("#fTimeHour").value = h;
    if ($("#fTimeMinute")) $("#fTimeMinute").value = Number(rawMinute) >= 30 ? "30" : "00";
  }

  function scheduledTime() {
    const useMobileSelectors = window.matchMedia?.("(max-width: 720px)")?.matches;
    if (useMobileSelectors) {
      const h = val("#fTimeHour") || "00";
      const m = val("#fTimeMinute") || "00";
      return `${h}:${m}`;
    }
    return val("#fTime");
  }

  function openNativePicker(selector) {
    const input = $(selector);
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else { input.focus(); input.click(); }
    } catch {
      input.focus();
    }
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
    const publishRow = $("#premiumPublishRow");
    if (fields) fields.hidden = !premium;
    if (publishRow) publishRow.hidden = !premium;
  }

  function normalizeScore(value) {
    return String(value || "").trim().replace(/[：﹕]/g, ":").replace(/\s+/g, "");
  }

  function predictionHit(prediction, aScore, bScore) {
    const normalized = normalizeScore(prediction);
    const match = normalized.match(/(\d+):(\d+)$/);
    if (!match) return false;
    return Number(match[1]) === Number(aScore) && Number(match[2]) === Number(bScore);
  }


  function renderResultManager(m) {
    if (m.status === "finished") {
      const trend = m.trendHit === true
        ? '<span class="result-hit">✓ 賽事觀點符合</span>'
        : (m.trendHit === false ? '<span class="result-miss">✕ 賽事觀點未符合</span>' : '<span class="result-miss">賽事觀點未標記</span>');
      return `<div class="admin-result-finished">
        <span class="result-badge">已完賽</span>
        <strong>${window.KEL.escapeHtml(m.result || "-")}</strong>
        ${m.resultHit ? '<span class="result-hit">✓ 比分命中</span>' : '<span class="result-miss">✕ 比分未命中</span>'}
        ${trend}
        <button class="btn btn-secondary btn-small" data-reopen="${m.id}">重新開啟</button>
      </div>`;
    }
    return `<div class="admin-result-entry">
      <div class="result-team-label">${window.KEL.escapeHtml(m.teamAShort)}</div>
      <input class="input result-score-input" data-score-a="${m.id}" type="number" min="0" max="5" inputmode="numeric" placeholder="0">
      <span class="result-colon">：</span>
      <input class="input result-score-input" data-score-b="${m.id}" type="number" min="0" max="5" inputmode="numeric" placeholder="0">
      <div class="result-team-label">${window.KEL.escapeHtml(m.teamBShort)}</div>
      <label class="result-trend-field">
        <span>賽事觀點結果</span>
        <select class="select result-trend-select" data-trend-hit="${m.id}">
          <option value="">請選擇</option>
          <option value="true">✅ 符合分析</option>
          <option value="false">❌ 未符合分析</option>
        </select>
      </label>
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
          <small>${window.KEL.fmtDate(m.date)} ${window.KEL.escapeHtml(m.time)}｜${m.premium ? "K Premium" : "一般分析"}${m.premium && m.analysisPublished === false ? "｜焦點預告中" : (m.premium ? "｜分析已發布" : "")}｜${m.status === "finished" ? "已結束" : "未完賽"}</small>
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
    const trend = document.querySelector(`[data-trend-hit="${CSS.escape(id)}"]`);
    const aScore = Number(a?.value), bScore = Number(b?.value);
    if (!Number.isInteger(aScore) || !Number.isInteger(bScore) || aScore < 0 || bScore < 0) {
      window.KEL.openModal("比分資料不足", "請先輸入雙方最終比分。"); return;
    }
    if (aScore === bScore) {
      window.KEL.openModal("比分不正確", "系列賽最終比分不能平手。"); return;
    }
    if (!trend?.value) {
      window.KEL.openModal("尚未標記賽事觀點", "請選擇本場賽事觀點最終是否符合分析。"); return;
    }
    const updated = {...m,
      status:"finished",
      result:`${m.teamAShort} ${aScore}：${bScore} ${m.teamBShort}`,
      resultHit:predictionHit(m.prediction, aScore, bScore),
      trendHit:trend.value === "true"
    };
    await api("/api/admin-matches", {method:"POST", body:JSON.stringify(updated)});
    await loadAdminMatches();
    window.KEL.openModal("已確認完賽", `最終比分 ${updated.result}；預測比分 ${updated.resultHit ? "命中" : "未命中"}，賽事觀點 ${updated.trendHit ? "符合" : "未符合"}。`);
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
      time: scheduledTime(),
      bo: val("#fBo") || "BO3",
      teamA: teamA?.name || "",
      teamAShort,
      teamALogo: teamA?.logo || "",
      teamB: teamB?.name || "",
      teamBShort,
      teamBLogo: teamB?.logo || "",

      // 狀態不再於新增表單手動維護；新賽事預設 upcoming。
      status: old?.status || "upcoming",

      // 所有場次都固定填寫。
      preview: val("#fPreview"),
      recommendationPrimary: val("#fPrimary"),
      prediction: val("#fPrediction"),

      // K Premium 才使用的深度內容。賽事觀點與預測比分沿用上方共用欄位。
      premium,
      // 舊資料沒有 analysisPublished 時視為已發布；新焦點賽事可先取消勾選，進入預告模式。
      analysisPublished: premium ? checked("#fAnalysisPublished") : true,
      publishedAt: premium && checked("#fAnalysisPublished")
        ? (old?.analysisPublished === false ? new Date().toISOString() : (old?.publishedAt || ""))
        : "",
      price: premium ? Number(val("#fPrice") || 39) : 0,
      conditions: premium ? val("#fConditions") : "",
      risk: premium ? val("#fRisk") : "",
      keyPoint: premium ? val("#fKeyPoint") : "",

      // 保留既有完賽資料。
      result: old?.result || "",
      resultHit: !!old?.resultHit,
      trendHit: old?.trendHit ?? null
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
      const saved = await api("/api/admin-matches", { method: "POST", body: JSON.stringify(m) });
      await loadAdminMatches();
      resetForm();
      const push = saved?.reminderNotification;
      const pushText = push?.triggered
        ? (push.configured
            ? ` 已通知 ${push.sent || 0} 位已設定賽事提醒的使用者${push.failed ? `，${push.failed} 筆推播失敗` : ""}。`
            : " 賽事已發布，但瀏覽器推播尚未完成 VAPID 設定，因此本次沒有送出提醒。")
        : "";
      window.KEL.openModal("已儲存", `賽事已寫入雲端資料庫，正式網站會讀取同一份資料。${pushText}`);
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
      "#fPrimary":m.recommendationPrimary,
      "#fPrediction":m.prediction,
      "#fRisk":m.risk,
      // 舊母版若只有 matchup，暫時帶入關鍵勝負節點避免內容直接遺失。
      "#fKeyPoint":m.keyPoint || m.matchup || ""
    };
    Object.entries(map).forEach(([sel,v]) => { if ($(sel)) $(sel).value = v ?? ""; });
    setScheduledTime(m.time || "");
    fillTeamSelects(m.teamAShort, m.teamBShort);
    $("#fPremium").checked = !!m.premium;
    if ($("#fAnalysisPublished")) $("#fAnalysisPublished").checked = m.analysisPublished !== false;
    updatePremiumFields();
    $("#formTitle").textContent = "編輯賽事";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function duplicateMatch(id) {
    const m = adminMatches.find(x => x.id === id); if (!m) return;
    const copy = {...m, id: `${m.id}-copy-${Date.now().toString().slice(-5)}`, status:"upcoming", result:"", resultHit:false, trendHit:null, analysisPublished:m.premium ? false : true, publishedAt:""};
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
    if ($("#fAnalysisPublished")) $("#fAnalysisPublished").checked = true;
    setScheduledTime("");
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
    $("#fTime")?.addEventListener("change", (e) => setScheduledTime(e.target.value));
    $("#fTimeHour")?.addEventListener("change", () => { if ($("#fTime")) $("#fTime").value = `${val("#fTimeHour") || "00"}:${val("#fTimeMinute") || "00"}`; });
    $("#fTimeMinute")?.addEventListener("change", () => { if ($("#fTime")) $("#fTime").value = `${val("#fTimeHour") || "00"}:${val("#fTimeMinute") || "00"}`; });
    document.querySelectorAll("[data-picker]").forEach(btn => btn.addEventListener("click", () => openNativePicker(btn.dataset.picker)));
    buildMobileTimeOptions();
    setScheduledTime("");
    fillTeamSelects();
    checkSession();
  });
})();
