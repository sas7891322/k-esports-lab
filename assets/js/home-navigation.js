(function () {
  function dt(m) { return `${m?.date || "9999-12-31"} ${m?.time || "23:59"}`; }
  async function renderFeaturedPriority() {
    if (!window.KEL?.getMatches || !window.KEL?.listRow) return;
    try { await window.KEL.loadCloudMatches?.(); } catch {}
    const root = document.querySelector("#featuredList");
    if (!root) return;
    const matches = window.KEL.getMatches()
      .filter(m => m.status !== "finished")
      .sort((a, b) => (Number(!!b.premium) - Number(!!a.premium)) || dt(a).localeCompare(dt(b)))
      .slice(0, 4);
    root.innerHTML = matches.map(window.KEL.listRow).join("") || '<div class="empty">目前沒有待開賽賽事。</div>';
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderFeaturedPriority, { once:true });
  else renderFeaturedPriority();
})();