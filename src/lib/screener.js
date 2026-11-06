// National area scoring, carried over from the DealsDash Screener. Pure functions only.
export const DEFAULT_WEIGHTS = { flip: { yield: 0, rentGrowth: 0, growth12: 6, growth60: 3, liquidity: 6, flipEvidence: 8, flipUplift: 6 }, brrr: { yield: 10, rentGrowth: 4, growth12: 3, growth60: 5, liquidity: 5, flipEvidence: 0, flipUplift: 0 } };
export const FACTORS = [["yield", "Gross yield"], ["rentGrowth", "Rent growth (12m)"], ["growth12", "Price momentum (12m)"], ["growth60", "5-year growth"], ["liquidity", "Liquidity (sales)"], ["flipEvidence", "Flip evidence"], ["flipUplift", "Flip uplift"]];
export const NATIONS = { E: "England", W: "Wales", S: "Scotland", N: "N. Ireland" };
export const nationOf = (code) => NATIONS[(code || "E")[0].toUpperCase()] ? (code || "E")[0].toUpperCase() : "E";
export function buildFlipIndex(districts = []) {
  const map = {};
  for (const d of districts) { const m = (map[d.la_code] ||= { flips: 0, sales: 0, up: [] }); m.flips += d.flips || 0; m.sales += d.sales || 0; if ((d.flips || 0) > 0 && d.flip_uplift_pct != null) m.up.push(d.flip_uplift_pct); }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => { const s = [...v.up].sort((a, b) => a - b); return [k, { rate: v.sales > 0 ? v.flips / v.sales : null, uplift: s.length ? s[Math.floor(s.length / 2)] : null }]; }));
}
export function pickValues(a, type, fi) {
  const f = fi[a.code] || {}, best = (x, y) => (x == null ? y : y == null ? x : Math.max(x, y));
  const common = { growth60: a.growth60T, rentGrowth: a.rentGrowth12, liquidity: a.sales12m, flipEvidence: f.rate ?? null, flipUplift: f.uplift ?? null };
  if (type === "T") return { ...common, price: a.priceT ?? a.priceAll, yield: a.yieldT, growth12: a.growth12T };
  if (type === "S") return { ...common, price: a.priceS ?? a.priceAll, yield: a.yieldS, growth12: a.growth12S };
  const prices = [a.priceT, a.priceS].filter((v) => v != null);
  return { ...common, price: prices.length ? Math.min(...prices) : a.priceAll, yield: best(a.yieldT, a.yieldS), growth12: best(a.growth12T, a.growth12S) };
}
const rank = (v, sorted) => { let n = 0; for (const x of sorted) { if (x < v) n++; else break; } return (n / sorted.length) * 100; };
// Score = weighted percentile rank across the areas currently visible. Missing data is flagged, not zeroed.
export function scoreAreas(areas, strategy, type, fi, weights) {
  const sorted = {}; for (const [k] of FACTORS) sorted[k] = areas.filter((a) => !(strategy === "brrr" && a.rentSource === null)).map((a) => pickValues(a, type, fi)[k]).filter((v) => v != null).sort((a, b) => a - b);
  return areas.map((area) => {
    const vals = pickValues(area, type, fi);
    if (strategy === "brrr" && area.rentSource === null) return { area, vals, score: null, partial: false };
    let s = 0, t = 0, partial = false;
    for (const [k] of FACTORS) { const w = weights[k] ?? 0; if (!w) continue; if (vals[k] == null || !sorted[k].length) { partial = true; continue; } s += w * rank(vals[k], sorted[k]); t += w; }
    return { area, vals, score: t > 0 ? Math.round(s / t) : null, partial };
  });
}
