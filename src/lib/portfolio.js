// Business-level figures. Everything here is derived from deals and recorded money movements,
// so Home, Capital and the risk view always agree and nothing is entered twice.
import { evaluate, gbp } from "./evaluate.js";
import { checkCrewClash } from "./programme/pipeline.js";
import { capitalCost } from "./engine/capital.js";
import { complianceStatus, readiness, rentSummary } from "./hold.js";

// dir: +1 cash in, -1 cash out. kind drives how each movement is reported
export const MOVEMENTS = {
  equity_in: { label: "Your capital in", dir: 1, kind: "equity" }, drawings: { label: "Drawings", dir: -1, kind: "equity" },
  lender_in: { label: "Private lender loan in", dir: 1, kind: "lender" }, lender_out: { label: "Private lender repaid", dir: -1, kind: "lender" },
  bridge_in: { label: "Bridge drawn", dir: 1, kind: "bridge" }, bridge_out: { label: "Bridge repaid", dir: -1, kind: "bridge" },
  mortgage_in: { label: "Refinance mortgage in", dir: 1, kind: "mortgage" },
  purchase: { label: "Purchase price", dir: -1, kind: "cost" }, fees: { label: "Fees and tax", dir: -1, kind: "cost" }, refurb: { label: "Refurb payment", dir: -1, kind: "cost" },
  holding: { label: "Holding cost", dir: -1, kind: "cost" }, interest: { label: "Interest paid", dir: -1, kind: "cost" }, sale: { label: "Sale proceeds", dir: 1, kind: "income" },
  rent: { label: "Rent received", dir: 1, kind: "income" }, overhead: { label: "Business overhead", dir: -1, kind: "overhead" },
};
export const ACTIVE = ["Secured", "Refurb", "Marketing"];
export const STAGES = ["Lead", "Viewing", "Legal", "Bid or offer", "Secured", "Refurb", "Marketing", "Sold", "Held", "Dropped"];
const signed = (m) => (MOVEMENTS[m.type]?.dir || 0) * (Number(m.amount) || 0);
const total = (ms, f) => ms.filter(f).reduce((s, m) => s + (Number(m.amount) || 0), 0);

// A sold deal's real result comes from what was actually paid and received
export function dealActuals(dealId, movements) {
  const ms = movements.filter((m) => m.dealId === dealId);
  const costs = total(ms, (m) => MOVEMENTS[m.type]?.kind === "cost"), sale = total(ms, (m) => m.type === "sale"), rent = total(ms, (m) => m.type === "rent");
  return { costs, sale, rent, profit: sale + rent - costs, hasSale: sale > 0, spent: costs };
}
export function portfolio(deals, movements, facilities, ws, today = new Date().toISOString().slice(0, 10)) {
  const rows = deals.map((d) => ({ d, R: evaluate(d, ws), actual: dealActuals(d.id, movements) }));
  const active = rows.filter((r) => ACTIVE.includes(r.d.stage));
  const cash = movements.reduce((s, m) => s + signed(m), 0);
  const balance = (i, o) => total(movements, (m) => m.type === i) - total(movements, (m) => m.type === o);
  const equity = balance("equity_in", "drawings"), lenderDebt = balance("lender_in", "lender_out"), bridgeDebt = balance("bridge_in", "bridge_out");
  const sold = rows.filter((r) => r.d.stage === "Sold");
  // Realised profit only counts deals with a recorded sale. A sold deal without one is flagged
  const realised = sold.filter((r) => r.actual.hasSale).reduce((s, r) => s + r.actual.profit, 0);
  // Committed = forecast cash still to spend on live deals. Unknown forecasts are counted and flagged
  const committed = active.reduce((s, r) => s + Math.max(0, (r.R.cash ?? 0) - r.actual.spent), 0);
  const available = cash - committed;
  const overhead = Number(ws.monthlyOverhead) || 0;
  const runway = overhead > 0 ? available / overhead : null;
  const base = equity + realised, leverage = base > 0 ? (bridgeDebt + lenderDebt) / base : null;
  const byArea = {};
  active.forEach((r) => { const k = (r.d.postcode || "Unknown").trim().split(/\s+/)[0]; byArea[k] = (byArea[k] || 0) + (r.R.cash ?? 0); });
  const totalActive = Object.values(byArea).reduce((a, b) => a + b, 0);
  const top = Object.entries(byArea).sort((a, b) => b[1] - a[1])[0];
  const concentration = top && totalActive > 0 ? { area: top[0], share: top[1] / totalActive } : null;
  const pool = facilities.map((f) => poolRow(f, movements, today));

  const alerts = [];
  const add = (level, text, view) => alerts.push({ level, text, view });
  if (available < 0) add("bad", `Cash is short by ${gbp(-available)} once live deals are funded`, "capital");
  else if (runway != null && runway < 3) add("warn", `${runway.toFixed(1)} months of cash left after commitments`, "capital");
  if (leverage != null && leverage > 2) add("warn", `Debt is ${leverage.toFixed(1)} times your own capital`, "capital");
  if (concentration && active.length > 1 && concentration.share > 0.6) add("warn", `${Math.round(concentration.share * 100)}% of live deal cash is in ${concentration.area}`, "home");
  for (const r of active) if (r.R.status === "incomplete") add("warn", `${r.d.address || "Untitled deal"} has missing figures, so its cash need is understated`, `deal:${r.d.id}`);
  for (const r of sold) if (!r.actual.hasSale) add("warn", `${r.d.address} is marked sold with no sale proceeds recorded`, `deal:${r.d.id}`);
  for (const r of rows) { if (["Dropped", "Sold"].includes(r.d.stage)) continue; for (const f of r.d.legal?.findings || []) if (f.rag === "R" && !f.done) add("bad", `${r.d.address}: ${f.text}`, `deal:${r.d.id}`); }
  for (const p of pool) { if (p.status === "overdue") add("bad", `${p.name} is past its repayment date`, "capital"); if (p.status === "due soon") add("warn", `${p.name} is due within 60 days`, "capital"); }
  const crew = active.filter((r) => r.R.prog).map((r) => ({ name: r.d.address, worksStart: r.R.prog.keyDates.worksStart, pc: r.R.prog.keyDates.pc }));
  for (const cl of checkCrewClash(crew).clashes) add("warn", `Works overlap on ${crew[cl.i].name} and ${crew[cl.j].name}`, "home");
  for (const r of rows.filter((x) => x.d.stage === "Held")) {
    for (const i of r.d.hold?.compliance || []) { const s = complianceStatus(i.expiry, today); if (s === "Overdue") add("bad", `${r.d.address}: ${i.type} is overdue`, `deal:${r.d.id}`); if (s === "Expiring soon") add("warn", `${r.d.address}: ${i.type} expires soon`, `deal:${r.d.id}`); }
    const a = rentSummary(r.d.hold?.rent).arrears; if (a > 0) add("bad", `${r.d.address}: ${gbp(a)} rent arrears`, `deal:${r.d.id}`);
  }
  return { rows, active, cash, equity, lenderDebt, bridgeDebt, realised, committed, available, overhead, runway, leverage, concentration, pool, alerts, held: rows.filter((x) => x.d.stage === "Held").map((r) => ({ ...r, ready: readiness(r.d.hold, today) })) };
}
// One private lender facility. Interest is simple, on the balance since each drawdown.
function poolRow(f, movements, today) {
  const ms = movements.filter((m) => m.facilityId === f.id);
  const drawn = total(ms, (m) => m.type === "lender_in"), repaid = total(ms, (m) => m.type === "lender_out");
  const owed = drawn - repaid;
  const accrued = ms.filter((m) => m.type === "lender_in").reduce((s, m) => s + capitalCost(Number(m.amount), Math.max(0, (Date.parse(today) - Date.parse(m.date)) / 86400000 / 30.4375), (Number(f.rate) || 0) / 100).cost, 0);
  const first = ms.filter((m) => m.type === "lender_in").map((m) => m.date).sort()[0];
  let dueDate = null, status = owed > 0 ? "live" : "not drawn";
  if (first) { const x = new Date(first + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + (Number(f.term) || 12)); dueDate = x.toISOString().slice(0, 10);
    if (owed > 0) { const days = (Date.parse(dueDate) - Date.parse(today)) / 86400000; status = days < 0 ? "overdue" : days <= 60 ? "due soon" : "live"; } else status = "repaid"; }
  return { ...f, drawn, repaid, owed, undrawn: Math.max(0, (Number(f.size) || 0) - owed), accrued, dueDate, status };
}
// Forward plan. Unlike the old simulator, it deducts overheads, lender interest and tax.
export function simulate({ startCash, cashPerDeal, months, profitPerDeal, maxDeals, target, overhead = 0, lenderInterest = 0, taxPct = 0, horizon = 60 }) {
  let cash = Number(startCash) || 0, live = [], reached = null, cumulative = 0;
  const net = profitPerDeal * (1 - taxPct / 100), done = Array(horizon + 1).fill(0), timeline = [];
  for (let m = 1; m <= horizon; m++) {
    while (cash >= cashPerDeal && live.length < maxDeals && cashPerDeal > 0) { cash -= cashPerDeal; live.push(months); }
    live = live.map((x) => x - 1).filter((x) => { if (x <= 0) { cash += cashPerDeal + net; done[m] += net; cumulative += net; return false; } return true; });
    cash -= overhead + lenderInterest;
    // Income run-rate is trailing 12-month profit after tax, less running costs
    let trailing = 0; for (let k = Math.max(1, m - 11); k <= m; k++) trailing += done[k];
    // Always divided by 12, so one early sale can't look like a steady monthly income
    const income = trailing / 12 - overhead - lenderInterest;
    if (reached === null && income >= target) reached = m;
    timeline.push({ month: m, cash, deals: live.length, income, cumulative });
  }
  return { timeline, reached };
}
