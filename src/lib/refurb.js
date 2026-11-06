// Refurb in three levels of detail: rough £/m², a total figure, or itemised lines.
// Itemised lines also tell the programme what work is in scope, so scope is only entered once.
export const SCOPE_LABELS = [["pre2000", "Built before 2000"], ["structural", "Structural"], ["dampTimber", "Damp or timber"], ["roofExternal", "Roof or externals"], ["windowsDoors", "Windows and doors"], ["rewire", "Rewire"], ["heatingBoiler", "Heating or boiler"], ["kitchen", "Kitchen"], ["bathroom", "Bathroom"]];

// Starter list. Figures are illustrative benchmark rates and every one is editable on the deal.
export const STARTER_LINES = [
  ["Roof overhaul", "roofExternal", 1500, 2500, 4000], ["Full re-roof", "roofExternal", 6500, 8500, 11500], ["Structural repairs", "structural", 5000, 6500, 8000],
  ["Damp and timber treatment", "dampTimber", 1500, 2750, 4000], ["New kitchen", "kitchen", 6500, 7750, 9000], ["Kitchen refresh", "kitchen", 1800, 2800, 4000],
  ["New bathroom", "bathroom", 3500, 4900, 6500], ["Bathroom refresh", "bathroom", 1500, 2300, 3200], ["Full rewire", "rewire", 4000, 5750, 7500],
  ["Consumer unit and EICR", "", 700, 1100, 1500], ["New boiler", "heatingBoiler", 2500, 3250, 4000], ["Windows and doors", "windowsDoors", 2000, 3000, 4900],
  ["Decorating", "", 3500, 4800, 6500], ["Flooring", "", 2500, 3500, 4500], ["Plastering and making good", "", 1000, 1800, 3000], ["Scaffold", "", 2000, 2800, 3800], ["Skips and waste", "", 900, 1300, 1800],
];
let n = 0;
export const newLine = (name = "", scope = "", low = null, likely = null, high = null, on = true) => ({ id: `l${Date.now().toString(36)}${n++}`, name, scope, low, likely, high, on });
export const starterLines = () => STARTER_LINES.map((l) => newLine(l[0], l[1], l[2], l[3], l[4], false));

// Returns likely and high including contingency. Null means unknown and blocks a verdict.
export function refurbOf(d, c) {
  if (d.refMode === "rough") {
    if (d.area == null || d.rate == null) return { likely: null, high: null, basis: "rough" };
    const likely = d.area * d.rate * (1 + c.cont);
    return { likely, high: likely * c.highX, basis: "rough", estHigh: true };
  }
  if (d.refMode === "items") {
    const on = (d.lines || []).filter((l) => l.on);
    if (!on.length) return { likely: null, high: null, basis: "items", missing: ["refurb lines"] };
    const blank = on.filter((l) => l.likely == null);
    if (blank.length) return { likely: null, high: null, basis: "items", missing: blank.map((l) => `likely cost for ${l.name || "a refurb line"}`) };
    const sum = (k) => on.reduce((s, l) => s + (l[k] ?? l.likely), 0);
    return { likely: sum("likely") * (1 + c.cont), high: sum("high") * (1 + c.cont), low: sum("low") * (1 + c.cont), basis: "items" };
  }
  if (d.refLikely == null) return { likely: null, high: null, basis: "total" };
  return { likely: d.refLikely, high: d.refHigh ?? d.refLikely * c.highX, basis: "total", estHigh: d.refHigh == null };
}
// Programme scope. Itemised deals derive it from their lines. Other deals use the ticks entered.
export function scopeOf(d) {
  if (d.refMode !== "items") return d.scope || {};
  const s = { pre2000: !!(d.scope && d.scope.pre2000) };
  for (const l of d.lines || []) if (l.on && l.scope) s[l.scope] = true;
  return s;
}
