(function () {
  let editId = null;
  const $ = (s) => document.querySelector(s);

  function slugify(v) { return String(v || "match").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function val(id) { return $(id)?.value?.trim() || ""; }
  function checked(id) { return !!$(id)?.checked; }

  function renderList() {
    const root = $("#adminList");
    if (!root || !window.KEL) return;
    const matches = window.KEL.getMatches().slice().sort((a,b) => b.date.localeCompare(a.date));
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
    const teamAShort = val("#fTeamAShort") || val("#fTeamA").slice(0,3).toUpperCase();
    const teamBShort = val("#fTeamBShort") || val("#fTeamB").slice(0,3).toUpperCase();
    const id = editId || `${slugify(val("#fLeague"))}-${slugify(teamAShort)}-${slugify(teamBShort)}-${date.replaceAll("-","")}-${Date.now().toString().slice(-5)}`;
    return {
      id,
      league: val("#fLeague") || "LCK",
      date,
      time: val("#fTime"),
      bo: val("#fBo") || "BO3",
      teamA: val("#fTeamA"), teamAShort,
      teamB: val("#fTeamB"), teamBShort,
      status: val("#fStatus") || "upcoming",
      premium: checked("#fPremium"),
      price: Number(val("#fPrice") || 39),
      summary: val("#fSummary"),
      preview: val("#fPreview"),
      recent: val("#fRecent"), matchup: val("#fMatchup"), bp: val("#fBp"), conditions: val("#fConditions"), variance: val("#fVariance"), market: val("#fMarket"),
      recommendationPrimary: val("#fPrimary"), recommendationSecondary: val("#fSecondary"), prediction: val("#fPrediction"), risk: val("#fRisk"),
      result: val("#fResult"), resultHit: checked("#fResultHit")
    };
  }

  function save(e) {
    e.preventDefault();
    const m = formData();
    if (!m.date || !m.teamA || !m.teamB) { window.KEL.openModal("資料不足", "至少要填日期、A 隊與 B 隊。 "); return; }
    const matches = window.KEL.getMatches();
    const idx = matches.findIndex(x => x.id === m.id);
    if (idx >= 0) matches[idx] = m; else matches.push(m);
    window.KEL.saveMatches(matches);
    resetForm(); renderList();
    window.KEL.openModal("已儲存", "賽事已寫入瀏覽器 LocalStorage。正式版後台會改接伺服器資料庫。 ");
  }

  function loadMatch(id) {
    const m = window.KEL.getMatches().find(x => x.id === id); if (!m) return;
    editId = id;
    const map = {
      "#fLeague":m.league,"#fDate":m.date,"#fTime":m.time,"#fBo":m.bo,"#fTeamA":m.teamA,"#fTeamAShort":m.teamAShort,"#fTeamB":m.teamB,"#fTeamBShort":m.teamBShort,"#fStatus":m.status,"#fPrice":m.price,
      "#fSummary":m.summary,"#fPreview":m.preview,"#fRecent":m.recent,"#fMatchup":m.matchup,"#fBp":m.bp,"#fConditions":m.conditions,"#fVariance":m.variance,"#fMarket":m.market,"#fPrimary":m.recommendationPrimary,"#fSecondary":m.recommendationSecondary,"#fPrediction":m.prediction,"#fRisk":m.risk,"#fResult":m.result
    };
    Object.entries(map).forEach(([sel,v]) => { if ($(sel)) $(sel).value = v ?? ""; });
    $("#fPremium").checked = !!m.premium; $("#fResultHit").checked = !!m.resultHit;
    $("#formTitle").textContent = "編輯賽事";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function duplicateMatch(id) {
    const matches = window.KEL.getMatches();
    const m = matches.find(x => x.id === id); if (!m) return;
    const copy = {...m, id: `${m.id}-copy-${Date.now().toString().slice(-5)}`, status:"upcoming", result:"", resultHit:false};
    matches.push(copy); window.KEL.saveMatches(matches); renderList();
  }

  function deleteMatch(id) {
    const matches = window.KEL.getMatches().filter(x => x.id !== id); window.KEL.saveMatches(matches); renderList();
  }

  function resetForm() {
    editId = null; $("#matchForm")?.reset();
    if ($("#fPrice")) $("#fPrice").value = 39;
    if ($("#formTitle")) $("#formTitle").textContent = "新增賽事";
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#matchForm")?.addEventListener("submit", save);
    $("#resetForm")?.addEventListener("click", resetForm);
    $("#resetDemo")?.addEventListener("click", () => { window.KEL.resetMatches(); location.reload(); });
    renderList();
  });
})();
