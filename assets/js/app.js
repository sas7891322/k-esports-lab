(function () {
  const STORAGE_KEY = "kel_matches_v12";

  function getMatches() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {}
    return window.KEL_DEFAULT_MATCHES || [];
  }

  function saveMatches(matches) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  }

  function resetMatches() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function fmtDate(date) {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function todayISO() {
    // 目前使用瀏覽器本地時區；正式後端上線後統一以 Asia/Taipei 處理。
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function teamBadge(short) {
    return `<div class="team-badge">${escapeHtml(short || "TEAM")}</div>`;
  }

  function premiumPill(m) {
    return m.premium ? '<span class="pill gold">★ K PREMIUM</span>' : '<span class="pill green">免費完整分析</span>';
  }

  function matchCard(m) {
    return `
      <article class="card match-card ${m.premium ? "premium" : ""}">
        <div class="match-meta">
          <span class="pill">${escapeHtml(m.league)}</span>
          <span>${fmtDate(m.date)}</span><span>${escapeHtml(m.time)}</span><span>${escapeHtml(m.bo)}</span>${m.week ? `<span>${escapeHtml(m.week)}</span>` : ""}
          ${premiumPill(m)}
        </div>
        <div class="teams">
          <div class="team">${teamBadge(m.teamAShort)}<div class="team-name">${escapeHtml(m.teamA)}</div></div>
          <div class="vs">VS</div>
          <div class="team">${teamBadge(m.teamBShort)}<div class="team-name">${escapeHtml(m.teamB)}</div></div>
        </div>
        <div class="match-note">${escapeHtml(m.summary || "")}</div>
        <div class="card-actions">
          <a class="btn ${m.premium ? "btn-gold" : "btn-primary"}" href="match.html?id=${encodeURIComponent(m.id)}">${m.premium ? `查看 K Premium｜NT$${m.price || 39}` : "查看完整分析"}</a>
        </div>
      </article>`;
  }

  function listRow(m) {
    return `
      <a class="list-row" href="match.html?id=${encodeURIComponent(m.id)}">
        <span class="pill">${escapeHtml(m.league)}</span>
        <div><strong>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}</strong><small>${fmtDate(m.date)}・${escapeHtml(m.time)}・${escapeHtml(m.bo)}</small></div>
        ${m.premium ? '<span class="pill gold">PREMIUM</span>' : '<span class="pill green">免費</span>'}
      </a>`;
  }

  function renderHome() {
    const todayEl = document.querySelector("#todayMatches");
    if (!todayEl) return;
    const matches = getMatches();
    let today = matches.filter(m => m.date === todayISO() && m.status !== "finished");
    // v1.2 首批正式內容為 2026/08/12，非當日開啟仍保留首批文章供檢視。
    if (!today.length) today = matches.filter(m => m.date === "2026-08-12" && m.status !== "finished");
    todayEl.innerHTML = today.length ? today.map(matchCard).join("") : '<div class="empty">今日尚無已發布賽事。</div>';

    const featured = matches.filter(m => m.status !== "finished").sort((a,b) => (b.premium - a.premium) || a.date.localeCompare(b.date)).slice(0, 4);
    const featuredEl = document.querySelector("#featuredList");
    if (featuredEl) featuredEl.innerHTML = featured.map(listRow).join("");

    const results = matches.filter(m => m.status === "finished").sort((a,b) => b.date.localeCompare(a.date)).slice(0, 4);
    const resultEl = document.querySelector("#latestResults");
    if (resultEl) resultEl.innerHTML = results.map(m => `
      <div class="result-row">
        <div><strong>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}</strong><small>預測：${escapeHtml(m.prediction || "-")}｜結果：${escapeHtml(m.result || "-")}</small></div>
        <div class="result-state">${m.resultHit ? "✅" : "❌"}</div>
      </div>`).join("") || '<div class="empty">尚無完賽紀錄。</div>';

    const leaguesEl = document.querySelector("#leagueGrid");
    if (leaguesEl) leaguesEl.innerHTML = (window.KEL_LEAGUES || []).map(l => {
      const lm = matches.filter(m => m.league === l && m.status !== "finished");
      const p = lm.filter(m => m.premium).length;
      return `<a class="card league-card" href="league.html?league=${encodeURIComponent(l)}"><div class="league-mark">${l.slice(0,3)}</div><strong>${l}</strong><small>${lm.length} 場｜${p} 場 Premium</small></a>`;
    }).join("");
  }

  function renderLeague() {
    const root = document.querySelector("#leagueMatches");
    if (!root) return;
    const league = (qs("league") || "LCK").toUpperCase();
    const title = document.querySelector("#leagueTitle");
    if (title) title.textContent = league;
    document.title = `${league}｜K Esports Lab`;
    const matches = getMatches().filter(m => m.league === league).sort((a,b) => a.date.localeCompare(b.date));
    const filter = qs("filter") || "all";
    let filtered = matches;
    if (filter === "premium") filtered = matches.filter(m => m.premium && m.status !== "finished");
    if (filter === "free") filtered = matches.filter(m => !m.premium && m.status !== "finished");
    if (filter === "finished") filtered = matches.filter(m => m.status === "finished");
    root.innerHTML = filtered.length ? filtered.map(matchCard).join("") : '<div class="empty">這個分類目前沒有賽事。</div>';

    document.querySelectorAll("[data-filter]").forEach(btn => {
      const href = `league.html?league=${encodeURIComponent(league)}&filter=${btn.dataset.filter}`;
      btn.href = href;
      if (btn.dataset.filter === filter) btn.classList.add("active");
    });
  }

  function analysisSection(title, content) {
    return `<section class="card analysis-section"><h3>${title}</h3><p>${escapeHtml(content || "尚未填寫")}</p></section>`;
  }

  function renderMatch() {
    const root = document.querySelector("#matchRoot");
    if (!root) return;
    const id = qs("id");
    const m = getMatches().find(x => x.id === id) || getMatches()[0];
    if (!m) { root.innerHTML = '<div class="empty">找不到賽事。</div>'; return; }
    document.title = `${m.teamAShort} vs ${m.teamBShort}｜K Esports Lab`;

    const locked = m.premium;
    root.innerHTML = `
      <div class="page-head">
        <div class="match-meta"><span class="pill">${escapeHtml(m.league)}</span><span>${fmtDate(m.date)}</span><span>${escapeHtml(m.time)}</span><span>${escapeHtml(m.bo)}</span>${m.week ? `<span>${escapeHtml(m.week)}</span>` : ""}${premiumPill(m)}</div>
      </div>
      <div class="card match-card ${m.premium ? "premium" : ""}" style="margin-bottom:18px">
        <div class="teams">
          <div class="team">${teamBadge(m.teamAShort)}<div class="team-name">${escapeHtml(m.teamA)}</div></div>
          <div class="vs">VS</div>
          <div class="team">${teamBadge(m.teamBShort)}<div class="team-name">${escapeHtml(m.teamB)}</div></div>
        </div>
        <div class="match-note">${escapeHtml(m.summary || "")}</div>
      </div>
      <div class="analysis-layout">
        <main class="analysis-main">
          ${analysisSection("賽前總覽", m.preview)}
          ${locked ? premiumLock(m) : `
            ${analysisSection("近期狀態", m.recent)}
            ${analysisSection("關鍵對位", m.matchup)}
            ${analysisSection("版本與 BP", m.bp)}
            ${analysisSection("雙方勝負條件", m.conditions)}
            ${analysisSection("本場變數", m.variance)}
            ${analysisSection("盤口二次核實", m.market)}
            ${analysisSection("主推薦", m.recommendationPrimary)}
            ${analysisSection("次推薦", m.recommendationSecondary)}
            ${analysisSection("風險提醒", m.risk)}
          `}
        </main>
        <aside class="sticky-side">
          <div class="card score-box"><span>預測比分</span><strong>${locked ? "🔒" : escapeHtml(m.prediction || "-")}</strong></div>
          <div class="card card-pad">
            <div class="eyebrow">K Esports Lab</div>
            <h3 style="margin:6px 0 8px">分析原則</h3>
            <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.7">免費與付費內容皆保留風險提醒。本站不接受投注、不代客下注、不提供派彩。</p>
          </div>
        </aside>
      </div>`;

    bindUnlockButtons();
  }

  function premiumLock(m) {
    return `<section class="card premium-lock">
      <div class="lock-icon">🔒</div>
      <div class="eyebrow" style="color:var(--gold)">K PREMIUM｜精選深度分析</div>
      <h3>以下內容需解鎖</h3>
      <p>完整精裝分析著重研究深度，不代表保證賽果。</p>
      <div class="premium-features">
        <span>近期狀態與深度數據</span><span>關鍵選手／路線對位</span><span>版本與 BP 分析</span><span>勝負條件與本場變數</span><span>盤口二次核實</span><span>主推薦、次推薦與最終結論</span>
      </div>
      <button class="btn btn-gold unlock-btn" data-price="${m.price || 39}">NT$${m.price || 39} 解鎖本場完整分析</button>
      <p style="margin-bottom:0">正式金流尚在審核／串接階段，目前不會產生任何收款。</p>
    </section>`;
  }

  function bindUnlockButtons() {
    document.querySelectorAll(".unlock-btn").forEach(btn => btn.addEventListener("click", () => openModal("K Premium 尚未開放收款", `單場 NT$${btn.dataset.price || 39} 解鎖流程已完成前台設計。待金流審核與正式訂單系統完成後才會開放付款。`)));
  }

  function openModal(title, text) {
    const modal = document.querySelector("#globalModal");
    if (!modal) return;
    modal.querySelector("[data-modal-title]").textContent = title;
    modal.querySelector("[data-modal-text]").textContent = text;
    modal.classList.add("open");
  }

  function initModal() {
    const modal = document.querySelector("#globalModal");
    if (!modal) return;
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-modal-close]")) modal.classList.remove("open"); });
  }

  function initMenu() {
    const btn = document.querySelector("#menuBtn");
    const menu = document.querySelector("#mobileMenu");
    if (btn && menu) btn.addEventListener("click", () => menu.classList.toggle("open"));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  window.KEL = { getMatches, saveMatches, resetMatches, openModal, matchCard, listRow, fmtDate, escapeHtml };

  document.addEventListener("DOMContentLoaded", () => {
    initMenu(); initModal(); renderHome(); renderLeague(); renderMatch(); bindUnlockButtons();
  });
})();
