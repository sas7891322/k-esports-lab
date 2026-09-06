function normalizeScoreText(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[：﹕]/g, ":")
    .replace(/\s+/g, " ");
}

function compact(value) {
  return normalizeScoreText(value).replace(/\s+/g, "");
}

function uniqueAliases(values) {
  return [...new Set(values.map(compact).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
}

function aliasesFor(match, side) {
  const values = side === "A"
    ? [match?.teamAShort, match?.teamA]
    : [match?.teamBShort, match?.teamB];
  return uniqueAliases(values);
}

function containsAlias(text, aliases) {
  const haystack = compact(text);
  return aliases.some(alias => haystack.includes(alias));
}

function findScore(value) {
  const normalized = normalizeScoreText(value);
  // LoL 系列賽局數為單位數；保留空白可避免 T1 + 3:1 被誤讀成 13:1。
  const match = normalized.match(/([0-9])\s*:\s*([0-9])/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isInteger(first) || !Number.isInteger(second)) return null;

  return { normalized, match, first, second };
}

export function parseSeriesScore(value) {
  const found = findScore(value);
  if (!found) return null;
  return { a: found.first, b: found.second };
}

// 將任何「隊名 + 比分」格式統一轉成資料欄位的 A:B 順序。
// 例如賽事資料是 A=DK、B=T1：
//   "DK 1:3 T1"            -> { a: 1, b: 3 }
//   "T1 3:1 Dplus KIA"     -> { a: 1, b: 3 }
// 這樣顯示順序不同也不會誤判為未命中。
export function parseSeriesScoreForMatch(value, match) {
  const found = findScore(value);
  if (!found) return null;

  const { normalized, match: scoreMatch, first, second } = found;
  const before = normalized.slice(0, scoreMatch.index);
  const after = normalized.slice(scoreMatch.index + scoreMatch[0].length);
  const aAliases = aliasesFor(match, "A");
  const bAliases = aliasesFor(match, "B");

  const beforeA = containsAlias(before, aAliases);
  const beforeB = containsAlias(before, bAliases);
  const afterA = containsAlias(after, aAliases);
  const afterB = containsAlias(after, bAliases);

  // 明確是「B隊 x:y A隊」時，翻回 A:B。
  if (beforeB && afterA && !(beforeA && afterB)) {
    return { a: second, b: first };
  }

  // 明確是「A隊 x:y B隊」時，維持 A:B。
  if (beforeA && afterB && !(beforeB && afterA)) {
    return { a: first, b: second };
  }

  // 只有一側隊名時，也盡量依隊名位置判斷。
  if (beforeB && !beforeA) return { a: second, b: first };
  if (beforeA && !beforeB) return { a: first, b: second };
  if (afterA && !afterB) return { a: second, b: first };
  if (afterB && !afterA) return { a: first, b: second };

  // 沒有足夠隊名資訊時，沿用既有規則：視為資料欄位 A:B。
  return { a: first, b: second };
}

export function deriveResultHit(match) {
  if (!match || match.status !== "finished") {
    return Boolean(match?.resultHit);
  }

  const prediction = parseSeriesScoreForMatch(match.prediction, match);
  const result = parseSeriesScoreForMatch(match.result, match);

  // 無法解析時保留既有人工資料，不擅自覆寫。
  if (!prediction || !result) return Boolean(match.resultHit);

  return prediction.a === result.a && prediction.b === result.b;
}

export function withDerivedResultHit(match) {
  if (!match || typeof match !== "object") return match;
  return {
    ...match,
    resultHit: deriveResultHit(match)
  };
}
