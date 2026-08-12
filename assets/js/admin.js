(function () {
  let editId = null;
  let adminMatches = [];
  const $ = (s) => document.querySelector(s);

  function slugify(v) { return String(v || "match").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function val(id) { return $(id)?.value?.trim() || ""; }
  function checked(id) { return !!$(id)?.checked; }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok) {
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
    const gate = $("#adminLoginGate");
    const app = $("#adminApp");
    const status = $("#adminLoginStatus");
    const form = $("#adminLoginForm");
    const hint = $("#adminSetupHint");

    try {
      const session = await api("/api/admin-session", { method: "GET", headers: {} });
      if (!session.configured) {
        status.textContent = "雲端後台尚未完成設定";
        hint.hidden = false;
        form.hidden = true;
        return;
      }
      if (!session.authenticated) {
        status.textContent = "請輸入管理員密碼";
        form.hidden = false;
        hint.hidden = true;
        return;
      }

      gate.hidden = true;
      app.hidden = false;
      await loadAdminMatches();
    } catch {
      status.textContent = "目前無法連線至後台 API";
      hint.hidden = false;
    }
  }

  async function login(e) {
    e.preventDefault();
    const status = $("#adminLoginStatus");
    try {
      await api("/api/admin-login", {
        method: "POST",
        body: JSON.stringify({ password: val("#adminPassword") })
      });
      status.textContent = "登入成功";
      location.reload();
    } catch (err) {
      status.textContent = err.status === 401 ? "密碼錯誤" : "登入失敗，請確認雲端設定";
    }
  }

  async function logout() {
    await api("/api/admin-logout", { method: "POST", body: "{}" }).catch(() => {});
    location.reload();
  }

  async function loadAdminMatches() {
    const data = await api("/api/admin-matches", { method: "GET", headers: {} });
    adminMatches = Array.isArray(data.matches) ? data.matches : [];
    renderList();
  }

  function renderList() {
    const root = $("#adminList");
    const matches = adminMatches.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    root.innerHTML = matches.map(m => `
      <div class="admin-item">
        <div><strong>${window.KEL.escapeHtml(m.league)}｜${window.KEL.escapeHtml(m.teamAShort)} vs ${window.KEL.escapeHtml(m.teamBShort)}</strong><small>${window.KEL.fmtDate(m.date)} ${window.KEL.escapeHtml(m.time)}｜${m.premium ? "K Premium" : "免費"}｜${window.KEL.escapeHtml(m.status)}</small></div>
        <div class="admin-item-actions">
          <button class="btn btn-secondary" data-edit="${m.id}">編輯</button>
          <button class="btn btn-secondary" data-duplicate="${m.id}">複製</button>
          <button class="btn btn-danger" data-delete="${m.id}">刪除</button>
        </div>
      </div>`).join("") || '<div class="empty">尚無賽事。</div>';
    root.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => loadMatch(b.dataset.edit)));
    root.querySelectorAll("[data-duplicate]").forEach(b => b.addEventListener("click", () => duplicateMatch(b.dataset.duplicate)));
    root.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteMatch(b.dataset.delete)));
  }

  function formData() {
    const date = val("#fDate");
    const teamA = selectedTeam("A");
    const teamB = selectedTeam("B");
    const teamAShort = teamA?.short || "";
    const teamBShort = teamB?.short || "";
    const id = editId || `${slugify(val("#fLeague"))}-${slugify(teamAShort)}-${slugify(teamBShort)}-${date.replaceAll("-","")}-${Date.now().toString().slice(-5)}`;
    return {
      id,
      league: val("#fLeague") || "LCK",
      date,
      time: val("#fTime"),
      bo: val("#fBo") || "BO3",
      teamA: teamA?.name || "",
      teamAShort,
      teamALogo: teamA?.logo || "",
      teamB: teamB?.name || "",
      teamBShort,
      teamBLogo: teamB?.logo || "",
      status: val("#fStatus") || "upcoming",
      premium: checked("#fPremium"),
      price: Number(val("#fPrice") || 39),
      summary: val("#fSummary"),
      preview: val("#fPreview"),
      recent: val("#fRecent"), matchup: val("#fMatchup"), bp: val("#fBp"), conditions: val("#fConditions"),
      variance: val("#fVariance"), market: val("#fMarket"),
      recommendationPrimary: val("#fPrimary"), recommendationSecondary: val("#fSecondary"),
      prediction: val("#fPrediction"), risk: val("#fRisk"),
      result: val("#fResult"), resultHit: checked("#fResultHit")
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
      "#fLeague":m.league,"#fDate":m.date,"#fTime":m.time,"#fBo":m.bo,"#fStatus":m.status,"#fPrice":m.price,
      "#fSummary":m.summary,"#fPreview":m.preview,"#fRecent":m.recent,"#fMatchup":m.matchup,"#fBp":m.bp,
      "#fConditions":m.conditions,"#fVariance":m.variance,"#fMarket":m.market,"#fPrimary":m.recommendationPrimary,
      "#fSecondary":m.recommendationSecondary,"#fPrediction":m.prediction,"#fRisk":m.risk,"#fResult":m.result
    };
    Object.entries(map).forEach(([sel,v]) => { if ($(sel)) $(sel).value = v ?? ""; });
    fillTeamSelects(m.teamAShort, m.teamBShort);
    $("#fPremium").checked = !!m.premium;
    $("#fResultHit").checked = !!m.resultHit;
    $("#formTitle").textContent = "編輯賽事";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function duplicateMatch(id) {
    const m = adminMatches.find(x => x.id === id); if (!m) return;
    const copy = {...m, id: `${m.id}-copy-${Date.now().toString().slice(-5)}`, status:"upcoming", result:"", resultHit:false};
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
    if ($("#formTitle")) $("#formTitle").textContent = "新增賽事";
    fillTeamSelects();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#adminLoginForm")?.addEventListener("submit", login);
    $("#adminLogout")?.addEventListener("click", logout);
    $("#matchForm")?.addEventListener("submit", save);
    $("#resetForm")?.addEventListener("click", resetForm);
    $("#fLeague")?.addEventListener("change", () => fillTeamSelects());
    $("#fTeamASelect")?.addEventListener("change", renderTeamPreviews);
    $("#fTeamBSelect")?.addEventListener("change", renderTeamPreviews);
    fillTeamSelects();
    checkSession();
  });
})();
