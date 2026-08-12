(() => {
  const TEAM_DATA = window.KEL_TEAMS || {};
  const leagueOrder = ["ALL", "LCK", "LPL", "LCP", "LEC", "LCS", "CBLOL"];
  const leagueLabels = {
    ALL: "全部",
    LCK: "LCK",
    LPL: "LPL",
    LCP: "LCP",
    LEC: "LEC",
    LCS: "LCS",
    CBLOL: "CBLOL"
  };

  const tabsRoot = document.getElementById("teamLeagueTabs");
  const gridRoot = document.getElementById("teamGrid");
  const countRoot = document.getElementById("teamCount");
  if (!tabsRoot || !gridRoot || !countRoot) return;

  let activeLeague = new URLSearchParams(location.search).get("league")?.toUpperCase() || "ALL";
  if (!leagueOrder.includes(activeLeague)) activeLeague = "ALL";

  function allTeamsFor(league) {
    const leagues = league === "ALL"
      ? leagueOrder.filter(x => x !== "ALL")
      : [league];

    const result = [];
    leagues.forEach(lg => {
      const teams = TEAM_DATA[lg] || {};
      Object.values(teams).forEach(team => result.push({ ...team, league: lg }));
    });
    return result;
  }

  function renderTabs() {
    tabsRoot.innerHTML = leagueOrder.map(lg => {
      const cls = lg === activeLeague ? "tab active" : "tab";
      return `<button class="${cls}" type="button" data-team-league="${lg}">${leagueLabels[lg]}</button>`;
    }).join("");

    tabsRoot.querySelectorAll("[data-team-league]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeLeague = btn.dataset.teamLeague;
        const url = new URL(location.href);
        if (activeLeague === "ALL") url.searchParams.delete("league");
        else url.searchParams.set("league", activeLeague);
        history.replaceState(null, "", url);
        renderTabs();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    const teams = allTeamsFor(activeLeague);
    countRoot.textContent = teams.length;

    if (!teams.length) {
      gridRoot.innerHTML = `<div class="empty">目前沒有收錄這個賽區的戰隊。</div>`;
      return;
    }

    gridRoot.innerHTML = teams.map(team => `
      <article class="team-db-card">
        <div class="team-db-league">${team.league}</div>
        <div class="team-db-logo-wrap">
          <img class="team-db-logo" src="${team.logo}" alt="${team.name}" loading="lazy">
        </div>
        <div class="team-db-short">${team.short}</div>
        <div class="team-db-name">${team.name}</div>
      </article>
    `).join("");
  }

  renderTabs();
  renderGrid();
})();
