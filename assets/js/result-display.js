(function () {
  function escapeHtml(value) {
    if (window.KEL?.escapeHtml) return window.KEL.escapeHtml(value);
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  function hitBadge(value) {
    if (value === true) return '<span class="result-hit-badge is-hit">✅ 命中</span>';
    if (value === false) return '<span class="result-hit-badge is-miss">❌ 未命中</span>';
    return '<span class="result-hit-badge is-pending">— 尚未標記</span>';
  }

  function injectStyles() {
    if (document.querySelector("#kelResultDisplayStyles")) return;
    const style = document.createElement("style");
    style.id = "kelResultDisplayStyles";
    style.textContent = `
      #latestResults .result-row.result-row-dual { display:block; padding:14px 0; }
      .result-row-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; }
      .result-row-title strong { font-size:14px; }
      .result-dual-lines { display:grid; gap:7px; }
      .result-dual-line { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; min-width:0; color:var(--muted); font-size:12px; line-height:1.55; }
      .result-dual-line + .result-dual-line { padding-top:7px; border-top:1px solid rgba(255,255,255,.045); }
      .result-dual-label { min-width:64px; color:#cfe0ef; font-weight:850; }
      .result-dual-line strong { color:#f2f7fc; font-size:12px; overflow-wrap:anywhere; }
      .result-dual-actual { color:#91a7c1; overflow-wrap:anywhere; }
      .result-hit-badge { display:inline-flex; align-items:center; padding:3px 7px; border-radius:999px; font-size:11px; font-weight:900; white-space:nowrap; }
      .result-hit-badge.is-hit { color:#8ff0b7; background:rgba(49,217,124,.08); border:1px solid rgba(49,217,124,.18); }
      .result-hit-badge.is-miss { color:#ff9ea7; background:rgba(255,93,108,.08); border:1px solid rgba(255,93,108,.18); }
      .result-hit-badge.is-pending { color:#a9bdd2; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.08); }
      @media (max-width:520px) {
        .result-dual-line { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:5px 7px; align-items:center; }
        .result-dual-actual { grid-column:2 / -1; }
        .result-hit-badge { justify-self:end; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderLatestResults() {
    const root = document.querySelector("#latestResults");
    if (!root || !window.KEL?.getMatches) return;
    const results = window.KEL.getMatches()
      .filter(m => m.status === "finished")
      .sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`))
      .slice(0, 4);

    root.innerHTML = results.map(m => `
      <div class="result-row result-row-dual">
        <div class="result-row-title">
          <strong>${escapeHtml(m.teamAShort)} vs ${escapeHtml(m.teamBShort)}</strong>
          <span class="pill">${escapeHtml(m.league || "")}</span>
        </div>
        <div class="result-dual-lines">
          <div class="result-dual-line result-dual-primary">
            <span class="result-dual-label">賽事觀點</span>
            <strong>${escapeHtml(m.recommendationPrimary || "-")}</strong>
            ${hitBadge(m.trendHit)}
          </div>
          <div class="result-dual-line">
            <span class="result-dual-label">預測比分</span>
            <strong>${escapeHtml(m.prediction || "-")}</strong>
            ${hitBadge(m.resultHit)}
            <span class="result-dual-actual">實際：${escapeHtml(m.result || "-")}</span>
          </div>
        </div>
      </div>`).join("") || '<div class="empty">尚無完賽紀錄。</div>';
  }

  function reorderMatchAudit() {
    const grid = document.querySelector(".result-audit-grid");
    if (!grid) return false;
    const items = [...grid.querySelectorAll(".result-audit-item")];
    const viewpoint = items.find(item => item.querySelector("span")?.textContent?.trim() === "賽事觀點");
    const prediction = items.find(item => item.querySelector("span")?.textContent?.trim() === "預測比分");
    if (!viewpoint || !prediction) return false;
    if (grid.firstElementChild !== viewpoint) {
      grid.appendChild(viewpoint);
      grid.appendChild(prediction);
    }
    return true;
  }

  async function init() {
    injectStyles();
    if (window.KEL?.loadCloudMatches) {
      try { await window.KEL.loadCloudMatches(); } catch {}
    }
    renderLatestResults();
    reorderMatchAudit();

    const matchRoot = document.querySelector("#matchRoot");
    if (matchRoot && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        if (reorderMatchAudit()) observer.disconnect();
      });
      observer.observe(matchRoot, { childList:true, subtree:true });
      setTimeout(() => observer.disconnect(), 8000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
