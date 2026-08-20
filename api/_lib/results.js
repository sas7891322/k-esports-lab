function normalizeScoreText(value) {
  return String(value || "")
    .trim()
    .replace(/[：﹕]/g, ":")
    .replace(/\s+/g, "");
}

export function parseSeriesScore(value) {
  const normalized = normalizeScoreText(value);
  const match = normalized.match(/(\d+):(\d+)/);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  return { a, b };
}

export function deriveResultHit(match) {
  if (!match || match.status !== "finished") {
    return Boolean(match?.resultHit);
  }

  const prediction = parseSeriesScore(match.prediction);
  const result = parseSeriesScore(match.result);

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
