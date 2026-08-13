(function () {
  const STORAGE_KEY = "kel_matches_v13";

  let cloudMatches = null;

  function getMatches() {
    if (Array.isArray(cloudMatches)) return cloudMatches;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}
    return JSON.parse(JSON.stringify(window.KEL_DEFAULT_MATCHES || []));
  }

  async function loadCloudMatches() {
    try {
      const res = await fetch("/api/matches", { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length) {
        cloudMatches = data.matches;
        return true;
      }
    } catch (error) {
      console.info("Cloud matches unavailable; using local/default data.", error);
    }
    return false;
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
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function teamBadge(short, logo, name) {
    if (logo) {
      return `<div class="team-logo-wrap"><img class="team-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(name || short || "TEAM")} 隊徽" loading="lazy"></div>`;
    }
    return `<div class="team-badge">${escapeHtml(short || "TEAM")}</div>`;
  }

  function premiumPill(m) {
    return m.premium
      ? '<span class="pill gold">★ 焦點賽事・K PREMIUM</span>'
      : '<span class="pill green">免費分析</span>';
  }

  function excerpt(value, max = 100) {
    const text = String(value || "").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
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
          <div class="team">${teamBadge(m.teamAShort, m.teamALogo, m.teamA)}<div class="team-name">${escapeHtml(m.teamA)}</div></div>
          <div class="vs">VS</div>
          <div class="team">${teamBadge(m.teamBShort, m.teamBLogo, m.teamB)}<div class="team-name">${escapeHtml(m.teamB)}</div></div>
        </div>
        <div class="match-note">${escapeHtml(excerpt(m.preview || "", 110))}</div>
        <div class="card-actions">
          <a class="btn ${m.premium ? "btn-gold" : "btn-primary"}" href="match.html?id=${encodeURIComponent(m.id)}">${m.premium ? "查看焦點賽事" : "查看免費分析"}</a>
        </div>
      </article>`;
  }

  function listRow(m) {
    return `
      <a class="list-row" href="match.html?id=${encodeURIComponent(m.id)}">
        <span class="pill">${escapeHtml(m.league)}</span>
        <div><strong>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}</strong><small>${fmtDate(m.date)}・${escapeHtml(m.time)}・${escapeHtml(m.bo)}</small></div>
        ${m.premium ? '<span class="pill gold">焦點＋PREMIUM</span>' : '<span class="pill green">免費</span>'}
      </a>`;
  }

  function renderHome() {
    const matches = getMatches();

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
    if (leaguesEl) {
      const leagueLogos = {
        LCK: "assets/img/leagues/lck.png",
        LPL: "assets/img/leagues/lpl.png",
        LCP: "assets/img/leagues/lcp.png",
        LEC: "assets/img/leagues/lec.png",
        LCS: "assets/img/leagues/lcs.png",
        CBLOL: "assets/img/leagues/cblol.png"
      };
      leaguesEl.innerHTML = (window.KEL_LEAGUES || []).map(l => {
        const lm = matches.filter(m => m.league === l && m.status !== "finished");
        const p = lm.filter(m => m.premium).length;
        const logo = leagueLogos[l];
        const mark = logo
          ? `<div class="league-mark league-logo-mark"><img src="${logo}" alt="${escapeHtml(l)} 賽區 Logo" loading="lazy"></div>`
          : `<div class="league-mark">${escapeHtml(l.slice(0,3))}</div>`;
        return `<a class="card league-card" href="league.html?league=${encodeURIComponent(l)}">${mark}<strong>${escapeHtml(l)}</strong><small>${lm.length} 場｜${p} 場焦點</small></a>`;
      }).join("");
    }
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

  function publicAnalysisHeader(m) {
    return `<section class="card card-pad" style="border-color:rgba(35,199,255,.22);background:rgba(35,199,255,.035)">
      <div class="eyebrow">免費公開分析</div>
      <h3 style="margin:6px 0 6px">所有讀者都可閱讀</h3>
      <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.7">${m.premium ? "本場為焦點賽事；基本分析維持公開，K Premium 僅提供額外深度研究與最終預測。" : "本場為一般賽事，分析內容與最終賽事結論皆免費公開。"}</p>
    </section>`;
  }

  function renderMatch() {
    const root = document.querySelector("#matchRoot");
    if (!root) return;
    const id = qs("id");
    const m = getMatches().find(x => x.id === id) || getMatches()[0];
    if (!m) { root.innerHTML = '<div class="empty">找不到賽事。</div>'; return; }
    document.title = `${m.teamAShort} vs ${m.teamBShort}｜K Esports Lab`;

    const locked = !!m.premium;
    root.innerHTML = `
      <div class="page-head">
        <div class="match-meta"><span class="pill">${escapeHtml(m.league)}</span><span>${fmtDate(m.date)}</span><span>${escapeHtml(m.time)}</span><span>${escapeHtml(m.bo)}</span>${m.week ? `<span>${escapeHtml(m.week)}</span>` : ""}${premiumPill(m)}</div>
      </div>

      <div class="card match-card ${m.premium ? "premium" : ""}" style="margin-bottom:18px">
        <div class="teams">
          <div class="team">${teamBadge(m.teamAShort, m.teamALogo, m.teamA)}<div class="team-name">${escapeHtml(m.teamA)}</div></div>
          <div class="vs">VS</div>
          <div class="team">${teamBadge(m.teamBShort, m.teamBLogo, m.teamB)}<div class="team-name">${escapeHtml(m.teamB)}</div></div>
        </div>
      </div>

      <div class="analysis-layout">
        <main class="analysis-main">
          ${m.status === "finished" && m.result ? analysisSection("最終賽果", m.result) : ""}
          ${publicAnalysisHeader(m)}
          ${analysisSection("分析看法", m.preview)}
          ${analysisSection("近期對位", m.recent)}
          ${analysisSection("關鍵對位", m.matchup)}
          ${analysisSection("雙方勝負條件", m.conditions)}
          ${analysisSection("不確定性提醒", m.risk || m.variance)}

          ${locked ? premiumLock(m) : `
            ${analysisSection("賽事傾向", m.recommendationPrimary)}
            ${analysisSection("預測比分", m.prediction)}
          `}
        </main>

        <aside class="sticky-side">
          ${locked
            ? `<div class="card score-box premium-score-locked"><span>深度研究・最終預測</span><strong>🔒 K Premium</strong></div>`
            : `<div class="card score-box"><span>預測比分</span><strong>${escapeHtml(m.prediction || "-")}</strong></div>`}
          <div class="card card-pad">
            <div class="eyebrow">K Esports Lab</div>
            <h3 style="margin:6px 0 8px">分析原則</h3>
            <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.7">分析內容著重隊伍狀態、對位、版本與比賽脈絡；所有賽事預測皆為研究判斷，不代表保證賽果。</p>
          </div>
        </aside>
      </div>`;

    bindUnlockButtons();
  }

  function premiumLock(m) {
    const price = m.price || 39;
    return `<section class="card premium-lock premium-product-box">
      <div class="lock-icon">🔒</div>
      <div class="eyebrow" style="color:var(--gold)">K PREMIUM｜焦點賽事深度分析</div>
      <h3>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}｜進階研究內容</h3>
      <div class="premium-product-price">NT$${price}<small>／單篇數位文章</small></div>
      <p>上方五欄基本分析維持免費公開；解鎖後閱讀額外的深度研究與最終賽事預測。</p>
      <div class="premium-features">
        <span>BP／版本研究</span>
        <span>預期比賽劇本</span>
        <span>關鍵勝負節點</span>
        <span>完整賽事傾向</span>
        <span>最終賽事預測</span>
        <span>預測比分</span>
      </div>
      <div class="delivery-note"><b>商品交付方式</b><span>正式啟用後，付款成功並經系統確認，即解鎖本篇 K Premium 深度分析文章閱讀權限。</span></div>
      <button class="btn btn-gold unlock-btn" data-price="${price}">NT$${price} 解鎖深度分析</button>
      <div class="purchase-policy-links"><a href="premium.html">商品說明</a><a href="digital-content.html">數位內容／退款說明</a><a href="terms.html">使用條款</a><a href="contact.html">客服聯絡</a></div>
      <p class="payment-review-note">目前金流收款功能申請／審核中，尚未開放實際付款，點擊按鈕不會產生任何扣款。</p>
      <p class="service-boundary-note">本站提供電競賽事研究與數位分析內容，不接受投注、不代客下注、不收取下注資金、不提供派彩。</p>
    </section>`;
  }

  function bindUnlockButtons() {
    document.querySelectorAll(".unlock-btn").forEach(btn => btn.addEventListener("click", () => openModal("K Premium 金流申請／審核中", `本篇深度分析售價為 NT$${btn.dataset.price || 39}。目前尚未開放實際付款，因此不會產生任何扣款；正式啟用後，付款成功將解鎖指定 K Premium 深度分析文章。`)));
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
    return String(value ?? "").replace(/[&<>'\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[ch]));
  }

  window.KEL = { getMatches, loadCloudMatches, saveMatches, resetMatches, openModal, matchCard, listRow, fmtDate, escapeHtml };

  document.addEventListener("DOMContentLoaded", async () => {
    initMenu();
    initModal();
    await loadCloudMatches();
    renderHome();
    renderLeague();
    renderMatch();
    bindUnlockButtons();
  });
})();
