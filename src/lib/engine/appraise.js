// The single appraisal engine. Formulas match the "Appraisal" tab of the 779 Ashton Road v2 workbook
// and use the repo's tested SDLT table and bisection solver. No other module calculates deal money.
import { sdltValue } from "./sdlt.js";
import { maxPrice } from "./solve.js";
import { monthlyMortgage, netMonthly } from "./cashflow.js";

const NATION = { England: "ENG", "Northern Ireland": "ENG", Scotland: "SCT", Wales: "WAL" };
export const nationCode = (n) => NATION[n] || "ENG";

// Costs shared by both strategies up to sale or refinance. VIXIV buys as a company, so higher SDLT rates apply.
function acquire(P, refurb, route, c, months, buyer = "company", nation = "ENG") {
  const auction = route === "auction";
  const r = { P, refurb, sdlt: sdltValue(P, { buyer, nation }), prem: auction ? Math.max(c.bpMin, c.bpRate * P) : 0,
    seller: auction ? c.sLegal + c.sDisb + c.sBank : 0, own: c.ownLegal + c.searches + c.lendFees, bridge: c.ltv * P };
  r.buying = r.prem + r.seller + r.own;
  // Finance = bridge interest + arrangement fee + private-lender interest on all other money in the deal
  r.fin = r.bridge * c.brM * months + r.bridge * c.brArr + ((P - r.bridge) + r.sdlt + r.buying + refurb * c.draw) * c.plRate / 12 * months;
  r.holdc = c.hold * months;
  return r;
}
// Flip outcome at price P. Extra months model a delayed sale.
export function flip(P, gdv, refurb, route, c, extra = 0, opts = {}) {
  const r = acquire(P, refurb, route, c, c.mFlip + extra, opts.buyer, opts.nation);
  r.gdv = gdv; r.salec = gdv * c.agentFee + c.saleLegal;
  r.total = P + r.sdlt + r.buying + refurb + r.fin + r.holdc + r.salec;
  r.profit = gdv - r.total; r.margin = gdv ? r.profit / gdv : 0;
  r.cash = r.total - r.bridge - r.salec;   // cash needed before sale, excluding the bridge advance
  return r;
}
// BRRR outcome at price P. Refinance money is borrowing, so it is never reported as profit.
export function brrr(P, val, refurb, route, c, rent, rateAdd = 0, opts = {}) {
  const r = acquire(P, refurb, route, c, c.mBrrr, opts.buyer, opts.nation);
  r.val = val; r.total = P + r.sdlt + r.buying + refurb + r.fin + r.holdc + c.refiFees;
  r.mort = val * c.refiLtv; r.left = r.total - r.mort;
  r.cf = netMonthly({ rent, mortgage: monthlyMortgage(r.mort, c.mortR + rateAdd, 0), mgmtPct: c.mgmt, maintPct: c.maint, insurance: c.ins }).net;
  r.cash = r.total - c.refiFees - r.bridge;
  return r;
}
// Highest price that still passes. The solver handles the premium minimum and SDLT threshold.
function highest(pass, top) {
  if (!pass(0)) return 0;
  return maxPrice((P) => (pass(P) ? -1 : 1), { lo: 0, hi: top, tol: 0.01 });
}
export const maxFlip = (gdv, ref, route, c, t, opts) => highest((P) => flip(P, gdv, ref, route, c, 0, opts).profit >= t * gdv, gdv * 2);
export const maxBrrr = (val, ref, route, c, keep, opts) => highest((P) => brrr(P, val, ref, route, c, 0, 0, opts).left <= keep, val * 2);
