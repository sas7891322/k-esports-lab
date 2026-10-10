(() => {
  const TEAM_DATA = window.KEL_TEAMS || {};

  // 國際／盃賽採「屆別名單」管理：只引用原六大賽區既有隊伍資料，
  // 不複製隊伍名稱、Logo 等資料，避免同一支隊伍維護兩份。
  window.KEL_TOURNAMENT_PARTICIPANTS = {
    "2026 德瑪西亞杯": [
      ["LCK", "KT"],
      ["LCK", "BFX"],
      ["LCK", "BRO"],
      ["LPL", "JDG"],
      ["LPL", "WE"],
      ["LPL", "LGD"],
      ["LEC", "VIT"],
      ["LEC", "NAVI"],
      ["LCS", "SR"],
      ["LCS", "FLY"],
      ["LCP", "GAM"],
      ["CBLOL", "RED"]
    ],

    // Worlds 2026：六大賽區共 19 支隊伍。
    "2026 世界賽": [
      ["LCK", "GEN"],
      ["LCK", "HLE"],
      ["LCK", "T1"],
      ["LCK", "DK"],
      ["LPL", "AL"],
      ["LPL", "BLG"],
      ["LPL", "TES"],
      ["LPL", "IG"],
      ["LEC", "G2"],
      ["LEC", "MKOI"],
      ["LEC", "KC"],
      ["LCS", "C9"],
      ["LCS", "TLAW"],
      ["LCS", "LYON"],
      ["LCP", "TSW"],
      ["LCP", "CFO"],
      ["LCP", "MVK"],
      ["CBLOL", "LOS"],
      ["CBLOL", "FUR"]
    ]
  };

  Object.entries(window.KEL_TOURNAMENT_PARTICIPANTS).forEach(([eventName, participants]) => {
    TEAM_DATA[eventName] = Object.fromEntries(
      participants
        .map(([originLeague, short]) => {
          const team = TEAM_DATA?.[originLeague]?.[short];
          if (!team) {
            console.warn(`[KEL] ${eventName} 找不到隊伍：${originLeague}/${short}`);
            return null;
          }
          return [short, { ...team, originLeague }];
        })
        .filter(Boolean)
    );
  });

  window.KEL_TOURNAMENTS = Object.keys(window.KEL_TOURNAMENT_PARTICIPANTS);
})();
