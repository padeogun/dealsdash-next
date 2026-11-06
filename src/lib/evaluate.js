// Turns one deal into its report: the single verdict used on every screen, the PDF and Home.
import { toConfig } from "./engine/assumptions.js";
import { flip, brrr, maxFlip, maxBrrr, nationCode } from "./engine/appraise.js";
import { schedule } from "./programme/schedule.js";
import { TEMPLATE } from "./programme/template.js";
import { refurbOf, scopeOf } from "./refurb.js";

// England and Wales bank holidays, carried from the repo's fallback list. Verify at gov.uk/bank-holidays.
export const BANK_HOLIDAYS = ["2026-12-25", "2026-12-28", "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28", "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29", "2028-08-28", "2028-12-25", "2028-12-26"];
export const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && v >= "2020-01-01" && v <= "2035-12-31" && !Number.isNaN(Date.parse(v));
export const gbp = (n) => (n == null ? "Unknown" : (n < 0 ? "-£" : "£") + Math.abs(Math.round(n)).toLocaleString("en-GB"));
export const pct = (f) => (f * 100).toFixed(1).replace(/\.0$/, "") + "%";
export const fmtDate = (iso) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not set");

// Caps stop a mistyped assumption from hanging the working-day scheduler
const cap = (n, max) => Math.min(Math.max(0, Number(n) || 0), max);
export function programmeFor(d, ws, c) {
  if (!validDate(d.secured)) return null;
  const custom = String(ws.nonWork || "").split(",").map((x) => x.trim()).filter(validDate);
  const r = schedule(TEMPLATE, { route: d.route, dealSecured: d.secured, scope: scopeOf(d), auctionCompletionDays: cap(c.progAuction, 3650), agentExchangeToCompletion: cap(c.progAgent, 3650),
    agentSaleToAgreement: cap(c.progAgree, 3650), saleExchangeToCompletion: cap(c.progSale, 3650), retentionReleaseLag: cap(c.progRetain, 3650), contingencyPct: cap(c.progCont, 10), winterDryingExtra: cap(c.progWinter, 3650) },
    [...BANK_HOLIDAYS, ...custom], d.actuals || {});
  if (r.status !== "complete") return null;
  // Months held runs from purchase completion to sale completion
  r.months = (Date.parse(r.keyDates.saleCompleted) - Date.parse(r.keyDates.completion)) / 86400000 / 30.4375;
  return r;
}

export function evaluate(d, ws = {}) {
  const c = toConfig(d.a), ref = refurbOf(d, c), missing = [...(ref.missing || [])], flags = [];
  const isB = d.strategy === "brrr", opts = { buyer: ws.buyer || "company", nation: nationCode(d.nation) };
  // Time has one source: the override if entered, then the programme, then the Setup figure
  const prog = programmeFor(d, ws, c);
  let monthsSource = "Setup figure";
  if (!isB) {
    if (d.monthsOverride != null) { c.mFlip = d.monthsOverride; monthsSource = "your override"; }
    else if (prog) { c.mFlip = prog.months; monthsSource = "programme"; }
    else flags.push("Add a date to get programme dates. Months held uses the Setup figure until then");
  } else if (d.monthsOverride != null) { c.mBrrr = d.monthsOverride; monthsSource = "your override"; }
  if (prog?.flags.financeLate) flags.push("Lender legals finish after completion, so finance needs to be ready sooner");
  if (prog?.flags.slowMonthListing) flags.push("The property would be listed in a slow sales month");
  if (prog?.flags.winterExternal) flags.push("External works fall in winter, so the drying allowance applies");

  if (!d.address) missing.push("address");
  if (d.price == null) missing.push(d.route === "auction" ? "guide price" : "asking price");
  if (d.vWorst == null) missing.push("worst-case end value");
  if (d.vLikely == null) missing.push("likely end value");
  if (ref.likely == null && !ref.missing) missing.push(d.refMode === "rough" ? "floor area and £/m² rate" : "refurb figure");
  if (isB && d.rentWorst == null) missing.push("cautious rent");
  if (isB && d.rentLikely == null) missing.push("likely rent");
  if (d.nation === "Scotland" || d.nation === "Wales") missing.push(`${d.nation === "Scotland" ? "LBTT" : "LTT"} isn't built yet, so work out the tax manually`);
  const base = { c, ref, prog, flags, isB, monthsSource, months: isB ? c.mBrrr : c.mFlip };
  if (missing.length) return { ...base, status: "incomplete", word: "Incomplete", missing };

  const P = d.offer != null ? d.offer : d.price, rt = d.route;
  const core = (ws.coreAreas || []).flatMap((a) => a.postcodes || []).map((s) => s.toUpperCase());
  const out = (d.postcode || "").toUpperCase().trim().split(/\s+/)[0];
  if (core.length && out && !core.includes(out)) flags.push("Outside your core areas");
  if (ref.basis === "rough") flags.push("Refurb is a rough £/m² figure. Get quotes before you commit");
  else if (ref.estHigh) flags.push("High refurb is estimated from the likely figure");
  if (d.route === "auction" && d.pack !== "Reviewed") flags.push("Legal pack hasn't been reviewed");
  for (const f of d.legal?.findings || []) if (f.rag === "R" && !f.done) flags.push(`Legal: ${f.text}`);

  let ceiling, tests, stack, stress, stats, cfFail = false;
  if (!isB) {
    const atP = flip(P, d.vWorst, ref.likely, rt, c, 0, opts), wh = flip(P, d.vWorst, ref.high, rt, c, 0, opts);
    // The stress case must at least break even, so it can pull the ceiling down
    ceiling = Math.min(maxFlip(d.vWorst, ref.likely, rt, c, c.target, opts), maxFlip(d.vWorst, ref.high, rt, c, 0, opts));
    tests = [{ ok: atP.profit >= c.target * d.vWorst, t: `${pct(atP.margin)} profit on the worst value, against a ${pct(c.target)} target` },
      { ok: wh.profit >= 0, t: `Worst value with high refurb makes ${gbp(wh.profit)}` }];
    const at = flip(ceiling, d.vWorst, ref.likely, rt, c, 0, opts);
    stack = [["Worst-case end value", d.vWorst], [`Profit at the ceiling (${pct(at.margin)})`, -at.profit], ["Refurb, likely", -ref.likely], ["Auction and buying fees", -at.buying], ["Finance", -at.fin], ["Holding", -at.holdc], ["Sale costs", -at.salec], ["SDLT", -at.sdlt]];
    const row = (n, g, r, extra = 0, isBasis = false) => { const x = flip(P, g, r, rt, c, extra, opts); return { n, a: gbp(x.profit), b: pct(x.margin), isBasis }; };
    stress = { head: [`Scenario at ${gbp(P)}`, "Profit", "Margin"], rows: [row("Likely value, likely refurb", d.vLikely, ref.likely), row("Worst value, likely refurb", d.vWorst, ref.likely, 0, true), row("Worst value less 10%", d.vWorst * 0.9, ref.likely), row("Worst value, high refurb", d.vWorst, ref.high), row("Worst value, sale 3 months late", d.vWorst, ref.likely, 3)] };
    stats = [[gbp(ceiling), "Ceiling"], [gbp(atP.profit), "Profit, worst value"], [pct(atP.margin), "Margin"], [gbp(atP.cash), "Cash before sale, excluding bridge"]];
    Object.assign(base, { worstHighMargin: wh.margin, cash: atP.cash, bridge: atP.bridge, forecastProfit: atP.profit });
  } else {
    const atP = brrr(P, d.vWorst, ref.likely, rt, c, d.rentWorst, 0, opts);
    ceiling = maxBrrr(d.vWorst, ref.likely, rt, c, c.keepIn, opts);
    cfFail = atP.cf < c.minCf;
    tests = [{ ok: atP.left <= c.keepIn, t: `${gbp(atP.left)} left in on the worst value, against ${gbp(c.keepIn)} accepted` }, { ok: !cfFail, t: `${gbp(atP.cf)} monthly cash flow, against a ${gbp(c.minCf)} minimum` }];
    const at = brrr(ceiling, d.vWorst, ref.likely, rt, c, d.rentWorst, 0, opts);
    stack = [[`Mortgage at ${pct(c.refiLtv)} of worst value`, at.mort], ["Cash left in accepted", c.keepIn], ["Refurb, likely", -ref.likely], ["Auction and buying fees", -at.buying], ["Finance", -at.fin], ["Holding", -at.holdc], ["Refinance costs", -c.refiFees], ["SDLT", -at.sdlt]];
    const row = (n, v, r, rent, add = 0, isBasis = false) => { const x = brrr(P, v, r, rt, c, rent, add, opts); return { n, a: x.left < 0 ? `${gbp(-x.left)} out` : gbp(x.left), b: gbp(x.cf), isBasis }; };
    stress = { head: [`Scenario at ${gbp(P)}`, "Left in", "Cash flow"], rows: [row("Likely value, likely rent", d.vLikely, ref.likely, d.rentLikely), row("Worst value, cautious rent", d.vWorst, ref.likely, d.rentWorst, 0, true), row("Worst value less 10%", d.vWorst * 0.9, ref.likely, d.rentWorst), row("Worst value, high refurb", d.vWorst, ref.high, d.rentWorst), row("Rent less 10%, rate up 1 point", d.vWorst, ref.likely, d.rentWorst * 0.9, 0.01)] };
    stats = [[gbp(ceiling), "Ceiling"], [atP.left < 0 ? `${gbp(-atP.left)} out` : gbp(atP.left), "Left in, worst value"], [gbp(atP.cf), "Monthly cash flow"], [gbp(atP.cash), "Cash before refinance, excluding bridge"]];
    Object.assign(base, { cash: atP.cash, bridge: atP.bridge, cashFlow: atP.cf });
  }
  const gap = P - ceiling;
  // A gap inside the negotiate range is Negotiate. Anything beyond it is No-go
  const status = ceiling <= 0 || cfFail ? "nogo" : gap <= 0 ? "go" : gap / P <= c.maxGap ? "negotiate" : "nogo";
  const R = { ...base, status, word: { go: "Go", negotiate: "Negotiate", nogo: "No-go" }[status], missing: [], P, ceiling, gap, tests, stack, stress, stats, stackTotal: stack.reduce((s, x) => s + x[1], 0) };
  R.line = headline(R, d, cfFail);
  return R;
}
function headline(R, d, cfFail) {
  const label = d.offer != null ? "Your test price" : d.route === "auction" ? "The guide" : "The asking price";
  if (cfFail) return "The monthly cash flow is below your minimum at this price.";
  if (R.status === "go") return `${label} of ${gbp(R.P)} meets your criteria, with ${gbp(-R.gap)} to spare below the ceiling.`;
  if (R.status === "negotiate") return `${label} of ${gbp(R.P)} is ${gbp(R.gap)} above your ceiling of ${gbp(R.ceiling)}. ` + (d.route === "auction" ? "Don't bid past the ceiling. If it doesn't sell, make an offer to the auctioneer." : "Offer at or below the ceiling.");
  return R.ceiling <= 0 ? "No price meets your criteria on these figures." : `${label} of ${gbp(R.P)} is ${pct(R.gap / R.P)} above your ceiling of ${gbp(R.ceiling)}, outside your negotiate range.`;
}
