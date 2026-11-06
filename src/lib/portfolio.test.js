import { describe, it, expect } from "vitest";
import { portfolio, dealActuals, simulate } from "./portfolio.js";
import { readiness, rentSummary } from "./hold.js";
import { freshWorkspace } from "../data/seed.js";
import { ashtonDeal } from "../data/demoSeed.js";
describe("capital", () => {
  it("realised profit uses actual money, not the forecast", () => {
    const m = [{ id: "a", dealId: "x", type: "purchase", amount: 50000 }, { id: "b", dealId: "x", type: "sale", amount: 90000 }];
    expect(dealActuals("x", m).profit).toBe(40000);
    const p = portfolio([{ ...ashtonDeal(), id: "x", stage: "Sold" }], m, [], freshWorkspace());
    expect(p.realised).toBe(40000);
  });
  it("sold with no proceeds is flagged and not counted", () => { const p = portfolio([{ ...ashtonDeal(), id: "x", stage: "Sold" }], [], [], freshWorkspace()); expect(p.realised).toBe(0); expect(p.alerts.some((a) => /no sale proceeds/.test(a.text))).toBe(true); });
  it("loans are debt, not capital", () => { const p = portfolio([], [{ id: "e", type: "equity_in", amount: 10000 }, { id: "l", type: "lender_in", amount: 50000, date: "2026-01-01" }], [], freshWorkspace()); expect(p.cash).toBe(60000); expect(p.equity).toBe(10000); expect(p.lenderDebt).toBe(50000); expect(p.leverage).toBe(5); });
  it("plan is slower once overheads and tax are deducted", () => { const b = { startCash: 100000, cashPerDeal: 30000, months: 7, profitPerDeal: 20000, maxDeals: 3, target: 5000 }; const a = simulate(b).reached, z = simulate({ ...b, overhead: 1000, taxPct: 19, lenderInterest: 300 }).reached; expect(z).toBeGreaterThan(a); });
});
describe("refinance readiness", () => {
  it("a property with no evidence is not ready", () => { const r = readiness({}, "2027-01-01"); expect(r.verdict).toBe("Not ready"); expect(r.checks[2].pass).toBe(false); });
  it("part payment breaks seasoning", () => { expect(rentSummary([{ date: "2027-03-01", due: 900, received: 900 }, { date: "2027-02-01", due: 900, received: 500 }, { date: "2027-01-01", due: 900, received: 900 }]).seasoning).toBe(1); });
});
