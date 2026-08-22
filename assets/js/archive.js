(function () {
  const LEAGUES = ["ALL","LCK","LPL","LCP","LEC","LCS","CBLOL"];
  let currentLeague = "ALL";
  let currentWindow = "all";
  let resultLimit = 30;
  const $ = (s, root=document) => root.querySelector(s);

  function esc(v) {
    return window.KEL?.escapeHtml ? window.KEL.escapeHtml(v) :
      String(v ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }
  function localDateISO(offset=0) {
    const d = new Date(); d.setDate(d.getDate()+offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function weekEndISO() { return localDateISO(6); }
  function prettyDate(date) {
    if (!date) return "未定日期";
    const d = new Date(`${date}T00:00:00`);
    return `${d.getMonth()+1}/${d.getDate()}（${["日","一","二","三","四","五","六"][d.getDay()]}）`;
  }
  function hitBadge(value) {
    if (value === true) return '<span class="archive-hit is-hit">✅ 命中</span>';
    if (value === false) return '<span class="archive-hit is-miss">❌ 未命中</span>';
    return '<span class="archive-hit is-pending">— 尚未標記</span>';
  }

  function injectStyles() {
    if ($("#kelArchiveStyles")) return;
    const style = document.createElement("style");
    style.id = "kelArchiveStyles";
    style.textContent = `
      .archive-page{padding-top:28px;padding-bottom:46px}
      .archive-hero{padding:22px 24px;margin-bottom:16px}
      .archive-hero h1{margin:4px 0 7px;font-size:clamp(25px,5vw,38px)}
      .archive-hero p{margin:0;color:var(--muted);line-height:1.65}
      .archive-toolbar{padding:13px 14px;margin-bottom:16px;display:grid;gap:10px}
      .archive-filter-row{display:flex;flex-wrap:wrap;gap:7px}
      .archive-filter{min-height:36px;padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.02);color:#cbd9e8;font-size:12px;font-weight:850;text-decoration:none}
      .archive-filter.active{border-color:rgba(35,199,255,.45);background:rgba(35,199,255,.10);color:#bfeeff}
      .archive-filter.gold.active{border-color:rgba(244,196,78,.42);background:rgba(244,196,78,.09);color:#f9dfa0}
      .archive-groups{display:grid;gap:16px}
      .archive-day{overflow:hidden}
      .archive-day-head{padding:12px 15px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}
      .archive-day-head h2{margin:0;font-size:17px}
      .archive-day-head span{color:var(--muted);font-size:11px}
      .archive-match-list{display:grid}
      .archive-match{display:grid;grid-template-columns:74px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.055);text-decoration:none;color:inherit}
      .archive-match:last-child{border-bottom:0}
      .archive-match:hover{background:rgba(255,255,255,.018)}
      .archive-meta{display:grid;gap:4px}
      .archive-meta .pill{justify-self:start}
      .archive-time{font-size:12px;color:#9fb4ca;font-weight:800}
      .archive-versus{min-width:0}
      .archive-versus strong{display:block;font-size:14px;overflow-wrap:anywhere}
      .archive-versus small{display:block;margin-top:4px;color:var(--muted);font-size:11px}
      .archive-side{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
      .archive-result-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px 15px;border-bottom:1px solid rgba(255,255,255,.055)}
      .archive-result-row:last-child{border-bottom:0}
      .archive-result-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      .archive-result-title strong{font-size:14px}
      .archive-result-lines{display:grid;gap:6px}
      .archive-result-line{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;font-size:12px}
      .archive-result-label{min-width:64px;color:#cfe0ef;font-weight:850}
      .archive-result-line b{color:#edf5fd}
      .archive-actual{color:#8fa7be}
      .archive-hit{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:10.5px;font-weight:900;white-space:nowrap}
      .archive-hit.is-hit{color:#8ff0b7;border:1px solid rgba(49,217,124,.18);background:rgba(49,217,124,.07)}
      .archive-hit.is-miss{color:#ff9ea7;border:1px solid rgba(255,93,108,.18);background:rgba(255,93,108,.07)}
      .archive-hit.is-pending{color:#9db2c7;border:1px solid var(--line);background:rgba(255,255,255,.02)}
      .archive-more-wrap{display:flex;justify-content:center;margin-top:16px}
      .archive-empty{padding:32px 18px;text-align:center;color:var(--muted)}
      @media(max-width:620px){
        .archive-page{padding-top:18px}
        .archive-hero{padding:17px}
        .archive-toolbar{padding:11px}
        .archive-match{grid-template-columns:62px minmax(0,1fr);gap:9px;padding:12px}
        .archive-side{grid-column:2;justify-content:flex-start}
        .archive-result-row{grid-template-columns:1fr;padding:13px 12px}
        .archive-result-row>a{justify-self:start}
        .archive-result-line{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:5px 7px}
        .archive-actual{grid-column:2/-1}
      }`;
    document.head.appendChild(style);
  }

  function matchesForWindow(matches) {
    const today = localDateISO(0), tomorrow = localDateISO(1), end = weekEndISO();
    return matches.filter(m => {
      if (currentLeague !== "ALL" && m.league !== currentLeague) return false;
      if (m.status === "finished") return false;
      if (currentWindow === "today") return m.date === today;
      if (currentWindow === "tomorrow") return m.date === tomorrow;
      if (currentWindow === "week") return m.date >= today && m.date <= end;
      return true;
    });
  }
  function groupByDate(matches) {
    const map = new Map();
    matches.forEach(m => { const key=m.date||"9999-12-31"; if(!map.has(key)) map.set(key,[]); map.get(key).push(m); });
    return [...map.entries()];
  }
  function matchRow(m) {
    const premium = m.premium
      ? (m.analysisPublished === false ? '<span class="pill gold">焦點預告</span>' : '<span class="pill gold">K PREMIUM</span>')
      : '<span class="pill green">一般分析</span>';
    return `<a class="archive-match" href="match.html?id=${encodeURIComponent(m.id)}">
      <div class="archive-meta"><span class="pill">${esc(m.league)}</span><span class="archive-time">${esc(m.time||"未定")}</span></div>
      <div class="archive-versus"><strong>${esc(m.teamAShort)} vs ${esc(m.teamBShort)}</strong><small>${esc(m.bo||"")}・${m.premium&&m.analysisPublished===false?"焦點賽事預告":"查看賽事分析"}</small></div>
      <div class="archive-side">${premium}<span>›</span></div>
    </a>`;
  }
  function renderMatchCenter() {
    const root=$("#matchArchive"); if(!root||!window.KEL?.getMatches) return;
    const matches=matchesForWindow(window.KEL.getMatches()).sort((a,b)=>`${a.date||""} ${a.time||""}`.localeCompare(`${b.date||""} ${b.time||""}`));
    const groups=groupByDate(matches);
    root.innerHTML=groups.length?groups.map(([date,rows])=>`<section class="card archive-day"><div class="archive-day-head"><h2>${prettyDate(date)}</h2><span>${rows.length} 場</span></div><div class="archive-match-list">${rows.map(matchRow).join("")}</div></section>`).join(""):'<div class="card archive-empty">目前這個篩選條件沒有待開賽賽事。</div>';
  }
  function resultRow(m) {
    return `<div class="archive-result-row">
      <div>
        <div class="archive-result-title"><strong>${esc(m.teamAShort)} vs ${esc(m.teamBShort)}</strong><span class="pill">${esc(m.league)}</span>${m.premium?'<span class="pill gold">K PREMIUM</span>':""}</div>
        <div class="archive-result-lines">
          <div class="archive-result-line"><span class="archive-result-label">賽事觀點</span><b>${esc(m.recommendationPrimary||"-")}</b>${hitBadge(m.trendHit)}</div>
          <div class="archive-result-line"><span class="archive-result-label">預測比分</span><b>${esc(m.prediction||"-")}</b>${hitBadge(m.resultHit)}<span class="archive-actual">實際：${esc(m.result||"-")}</span></div>
        </div>
      </div>
      <a class="btn btn-secondary btn-small" href="match.html?id=${encodeURIComponent(m.id)}">查看紀錄</a>
    </div>`;
  }
  function renderResults() {
    const root=$("#resultArchive"); if(!root||!window.KEL?.getMatches) return;
    const all=window.KEL.getMatches().filter(m=>m.status==="finished"&&(currentLeague==="ALL"||m.league===currentLeague)).sort((a,b)=>`${b.date||""} ${b.time||""}`.localeCompare(`${a.date||""} ${a.time||""}`));
    const visible=all.slice(0,resultLimit), groups=groupByDate(visible);
    root.innerHTML=groups.length?groups.map(([date,rows])=>`<section class="card archive-day"><div class="archive-day-head"><h2>${prettyDate(date)}</h2><span>${rows.length} 場</span></div><div>${rows.map(resultRow).join("")}</div></section>`).join(""):'<div class="card archive-empty">目前沒有符合條件的賽果紀錄。</div>';
    const wrap=$("#resultMoreWrap"), btn=$("#resultMoreBtn");
    if(wrap&&btn){ wrap.hidden=visible.length>=all.length; btn.textContent=`顯示更多（尚有 ${Math.max(0,all.length-visible.length)} 場）`; }
  }
  function renderLeagueFilters(target,onChange) {
    const root=$(target); if(!root) return;
    root.innerHTML=LEAGUES.map(l=>`<button type="button" class="archive-filter ${l===currentLeague?"active":""}" data-league="${l}">${l==="ALL"?"全部賽區":l}</button>`).join("");
    root.querySelectorAll("[data-league]").forEach(btn=>btn.addEventListener("click",()=>{ currentLeague=btn.dataset.league; resultLimit=30; renderLeagueFilters(target,onChange); onChange(); }));
  }
  function bindWindowFilters() {
    const root=$("#matchWindowFilters"); if(!root) return;
    root.querySelectorAll("[data-window]").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.window===currentWindow);
      btn.addEventListener("click",()=>{ currentWindow=btn.dataset.window; root.querySelectorAll("[data-window]").forEach(x=>x.classList.toggle("active",x===btn)); renderMatchCenter(); });
    });
  }
  async function init() {
    injectStyles();
    try { await window.KEL?.loadCloudMatches?.(); } catch {}
    if($("#matchArchive")){ renderLeagueFilters("#matchLeagueFilters",renderMatchCenter); bindWindowFilters(); renderMatchCenter(); }
    if($("#resultArchive")){ renderLeagueFilters("#resultLeagueFilters",renderResults); renderResults(); $("#resultMoreBtn")?.addEventListener("click",()=>{resultLimit+=30;renderResults();}); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();