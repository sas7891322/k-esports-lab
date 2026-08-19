(function () {
  const STORAGE_KEY = "kel_matches_v13";
  const PURCHASE_STORAGE_KEY = "kel_purchases_v1";

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
      if (Array.isArray(data.matches)) {
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
    // 目前使用瀏覽器本地時區；正式後端上線後統一以 Asia/Taipei 處理。
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
    return m.premium ? '<span class="pill gold">★ K PREMIUM</span>' : '<span class="pill green">一般分析</span>';
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
          <a class="btn ${m.premium ? "btn-gold" : "btn-primary"}" href="match.html?id=${encodeURIComponent(m.id)}">${m.premium ? `查看 K Premium｜NT$${m.price || 39}` : "查看賽事分析"}</a>
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
        return `<a class="card league-card" href="league.html?league=${encodeURIComponent(l)}">${mark}<strong>${escapeHtml(l)}</strong><small>${lm.length} 場｜${p} 場 Premium</small></a>`;
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

  function getPurchases() {
    try { return JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function getPurchaseRef(matchId) {
    return getPurchases()[matchId] || null;
  }

  function savePurchaseRef(matchId, ref) {
    const purchases = getPurchases();
    purchases[matchId] = { order: ref.order, token: ref.token };
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(purchases));
  }

  function capturePurchaseFromQuery(matchId) {
    const order = qs("order");
    const token = qs("token");
    if (matchId && order && token) savePurchaseRef(matchId, { order, token });
  }

  async function getUnlockedContent(matchId) {
    const ref = getPurchaseRef(matchId);
    if (!ref?.order || !ref?.token) return null;
    try {
      const url = `/api/premium-content?matchId=${encodeURIComponent(matchId)}&order=${encodeURIComponent(ref.order)}&token=${encodeURIComponent(ref.token)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.unlocked ? data.content : null;
    } catch {
      return null;
    }
  }

  function premiumContentSections(content) {
    return [
      analysisSection("賽事傾向", content.recommendationPrimary),
      analysisSection("預測比分", content.prediction),
      analysisSection("雙方勝負條件", content.conditions),
      analysisSection("不確定性提醒", content.risk),
      analysisSection("關鍵勝負節點", content.keyPoint)
    ].join("");
  }

  async function renderMatch() {
    const root = document.querySelector("#matchRoot");
    if (!root) return;
    const id = qs("id");
    const allMatches = getMatches();
    const m = id ? allMatches.find(x => x.id === id) : allMatches[0];
    if (!m) { root.innerHTML = '<div class="empty">找不到賽事。</div>'; return; }
    document.title = `${m.teamAShort} vs ${m.teamBShort}｜K Esports Lab`;

    if (m.premium) capturePurchaseFromQuery(m.id);
    const unlockedContent = m.premium ? await getUnlockedContent(m.id) : null;
    const locked = !!m.premium && !unlockedContent;
    const displayedPrediction = unlockedContent?.prediction || m.prediction || "-";

    root.innerHTML = `
      <div class="page-head">
        <div class="match-meta"><span class="pill">${escapeHtml(m.league)}</span><span>${fmtDate(m.date)}</span><span>${escapeHtml(m.time)}</span><span>${escapeHtml(m.bo)}</span>${m.week ? `<span>${escapeHtml(m.week)}</span>` : ""}${premiumPill(m)}${unlockedContent ? '<span class="pill green">✓ 已解鎖</span>' : ""}</div>
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
          ${analysisSection("分析看法", m.preview)}

          ${m.premium
            ? (unlockedContent ? premiumContentSections(unlockedContent) : premiumLock(m))
            : `${analysisSection("賽事傾向", m.recommendationPrimary)}${analysisSection("預測比分", m.prediction)}`}
        </main>

        <aside class="sticky-side">
          ${locked
            ? `<div class="card score-box premium-score-locked"><span>賽事傾向・預測比分</span><strong>🔒 K Premium</strong></div>`
            : `<div class="card score-box"><span>預測比分</span><strong>${escapeHtml(displayedPrediction)}</strong></div>`}
          <div class="card card-pad">
            <div class="eyebrow">K Esports Lab</div>
            <h3 style="margin:6px 0 8px">分析原則</h3>
            <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.7">分析看法與賽事傾向著重比賽內容與判斷脈絡；所有預測內容皆不代表保證賽果。</p>
          </div>
        </aside>
      </div>`;

    bindUnlockButtons();
    refreshPaymentModeUI();
  }

  function premiumLock(m) {
    const price = m.price || 39;
    const finished = m.status === "finished";
    return `<section class="card premium-lock premium-product-box">
      <div class="lock-icon">🔒</div>
      <div class="eyebrow" style="color:var(--gold)">K PREMIUM｜數位內容商品</div>
      <h3>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}｜精選深度分析</h3>
      <div class="premium-product-price">NT$${price}<small>／單篇數位文章</small></div>
      <p>分析看法維持公開；購買後解鎖指定賽事的完整研究內容與最終結論。</p>
      <div class="premium-features">
        <span>賽事傾向</span><span>預測比分</span><span>雙方勝負條件</span><span>不確定性提醒</span><span>關鍵勝負節點</span>
      </div>
      <div class="delivery-note"><b>商品交付方式</b><span>付款完成並經綠界回傳交易成功後，系統自動解鎖本篇 K Premium 數位分析文章閱讀權限。</span></div>
      ${finished ? `<div class="payment-closed-note">本場賽事已結束，目前停止販售；既有購買者仍可使用原解鎖憑證閱讀。</div>` : `
        <div class="payment-method-title">選擇付款方式</div>
        <div class="payment-method-grid">
          <button class="btn btn-gold unlock-btn" data-match-id="${escapeHtml(m.id)}" data-method="ATM" data-price="${price}">NT$${price}｜ATM 虛擬帳號</button>
          <button class="btn btn-secondary unlock-btn" data-match-id="${escapeHtml(m.id)}" data-method="CVS" data-price="${price}">NT$${price}｜超商代碼</button>
        </div>
        <p class="payment-mode-note">綠界非信用卡收款已通過，正在載入付款環境…</p>`}
      <div class="purchase-policy-links"><a href="premium.html">商品說明</a><a href="digital-content.html">數位內容／退款說明</a><a href="terms.html">使用條款</a><a href="contact.html">客服聯絡</a></div>
      <p class="service-boundary-note">本站僅販售數位分析內容，不接受投注、不代客下注、不收取下注資金、不提供派彩。</p>
    </section>`;
  }

  async function refreshPaymentModeUI() {
    const note = document.querySelector(".payment-mode-note");
    const buttons = [...document.querySelectorAll(".unlock-btn")];
    if (!note || !buttons.length) return;
    try {
      const res = await fetch("/api/payment-config", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.enabled) throw new Error(data.error || "PAYMENT_DISABLED");
      if (data.mode === "stage") {
        note.innerHTML = '<strong>STAGE 測試環境</strong>｜不會產生真實款項；確認流程正常後再切換正式環境。';
        buttons.forEach(btn => { btn.dataset.originalText ||= btn.textContent; btn.textContent = `STAGE 測試｜${btn.dataset.originalText}`; });
      } else {
        note.innerHTML = '<strong>綠界正式環境</strong>｜付款完成並收到成功通知後，系統會自動解鎖本篇內容。';
      }
    } catch {
      note.textContent = "付款功能尚未完成伺服器設定，請稍後再試或聯絡客服。";
      buttons.forEach(btn => btn.disabled = true);
    }
  }

  function submitEcpayForm(action, params) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    form.acceptCharset = "UTF-8";
    Object.entries(params || {}).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  async function startPurchase(btn) {
    const matchId = btn.dataset.matchId;
    const paymentMethod = btn.dataset.method || "ATM";
    const originalText = btn.textContent;
    document.querySelectorAll(".unlock-btn").forEach(b => b.disabled = true);
    btn.textContent = "建立綠界訂單中…";
    try {
      const res = await fetch("/api/ecpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ matchId, paymentMethod })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
      savePurchaseRef(matchId, { order: data.orderNo, token: data.token });
      submitEcpayForm(data.action, data.params);
    } catch (error) {
      console.error(error);
      const messages = {
        DB_NOT_CONFIGURED: "雲端資料庫尚未設定，暫時無法建立訂單。",
        ECPAY_PRODUCTION_NOT_CONFIGURED: "綠界正式環境金鑰尚未完成設定。",
        MATCH_ALREADY_FINISHED: "本場賽事已結束，目前停止販售。",
        INVALID_PRICE: "商品價格不符合目前付款方式的建單限制。"
      };
      openModal("付款暫時無法建立", messages[error.message] || "目前無法建立綠界訂單，請稍後再試或聯絡客服。");
      document.querySelectorAll(".unlock-btn").forEach(b => b.disabled = false);
      btn.textContent = originalText;
    }
  }

  function bindUnlockButtons() {
    document.querySelectorAll(".unlock-btn").forEach(btn => btn.addEventListener("click", () => startPurchase(btn)));
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

  window.KEL = { getMatches, loadCloudMatches, saveMatches, resetMatches, openModal, matchCard, listRow, fmtDate, escapeHtml };

  document.addEventListener("DOMContentLoaded", async () => {
    initMenu();
    initModal();
    await loadCloudMatches();
    renderHome();
    renderLeague();
    await renderMatch();
  });
})();
