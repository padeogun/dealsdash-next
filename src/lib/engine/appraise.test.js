// Golden figures from the 779 Ashton Road v2 workbook and the training-day SDLT split. Do not edit to make a test pass.
import { describe, it, expect } from "vitest";
import { toConfig, defaultAssumptions } from "./assumptions.js";
import { flip, brrr, maxFlip, maxBrrr } from "./appraise.js";
import { splitBudget } from "./solve.js";
import { evaluate } from "../evaluate.js";
import { refurbOf, scopeOf } from "../refurb.js";
import { lenderAssumptions, romaProduct } from "./lenders.js";
import { ashtonDeal } from "../../data/demoSeed.js";
const c = toConfig(defaultAssumptions()), L = 39491, H = 55200, near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);
const o = { buyer: "company", nation: "ENG" };
describe("workbook", () => {
  it("flip ceilings", () => { near(maxFlip(150000, L, "auction", c, 0.2, o), 55219); near(maxFlip(150000, L, "auction", c, 0.15, o), 61903); near(maxFlip(165000, L, "auction", c, 0.2, o), 65673); near(maxFlip(150000, H, "auction", c, 0.2, o), 40891); });
  it("flip profit and cash at £55k", () => { near(flip(55000, 150000, L, "auction", c, 0, o).profit, 30245); near(flip(55000, 150000, H, "auction", c, 0, o).profit, 14170); near(flip(55000, 165000, L, "auction", c, 0, o).profit, 44975); expect(Math.round(flip(55000, 150000, L, "auction", c, 0, o).cash / 1000)).toBe(77); });
  it("BRRR", () => { near(maxBrrr(150000, L, "auction", c, 0, o), 51982); near(maxBrrr(150000, L, "auction", c, 10000, o), 61028); near(maxBrrr(165000, L, "auction", c, 0, o), 62159); near(brrr(55000, 150000, L, "auction", c, 1000, 0, o).left, 3336); near(brrr(55000, 165000, L, "auction", c, 1050, 0, o).left, -7914); });
  it("training SDLT split", () => { const s = splitBudget(110800, { buyer: "company" }); near(s.price, 105523.81); near(s.sdlt, 5276.19); });
});
describe("Ashton deal", () => {
  const d = ashtonDeal();
  it("itemised Lean scope totals the workbook", () => { const r = refurbOf(d, c); near(r.likely, L); near(r.high, H); });
  it("scope comes from the ticked lines", () => { const s = scopeOf(d); expect(s.structural && s.roofExternal && s.kitchen && s.bathroom && s.pre2000).toBe(true); expect(s.rewire).toBeFalsy(); });
  it("override reproduces the workbook ceiling", () => { const R = evaluate({ ...d, monthsOverride: 7 }, {}); near(R.ceiling, 55219); expect(R.status).toBe("negotiate"); near(R.stackTotal, R.ceiling); });
  it("programme drives months held", () => { const R = evaluate(d, {}); expect(R.monthsSource).toBe("programme"); expect(R.prog.keyDates.listed).toBeTruthy(); });
  it("a blank is unknown, never zero", () => { expect(evaluate({ ...d, vWorst: null }, {}).status).toBe("incomplete"); const lines = [{ on: true, name: "X", likely: null }]; expect(evaluate({ ...d, lines }, {}).status).toBe("incomplete"); });
  it("Scotland and Wales aren't given an England tax figure", () => { expect(evaluate({ ...d, nation: "Scotland" }, {}).status).toBe("incomplete"); expect(evaluate({ ...d, nation: "Wales" }, {}).status).toBe("incomplete"); });
});
describe("Roma terms", () => {
  const d = ashtonDeal();
  const roma = (P, ref, gdv) => { const r = lenderAssumptions(P, ref, 15); return { ...toConfig({ ...defaultAssumptions(), ...r.patch }), product: r.product }; };
  it("picks the product from the works ratio", () => { expect(roma(55000, 39491).product.name).toBe("Medium Refurbishment"); expect(romaProduct(100000, 0).name).toBe("FLOW Bridge"); expect(romaProduct(100000, 20000).name).toBe("FLOW Refurb"); expect(romaProduct(100000, 40000).name).toBe("FLOW Light Development"); expect(romaProduct(100000, 120000).name).toBe("Heavy Refurbishment"); });
  it("generic terms still match the workbook", () => { near(maxFlip(150000, L, "auction", c, 0.2, o), 55219); });
  it("costs reconcile and the deal still solves", () => { const k = roma(55000, L), a = flip(55000, 150000, L, "auction", k, 0, o); near(a.total, 55000 + a.sdlt + a.buying + L + a.fin + a.holdc + a.salec); expect(a.gross).toBeGreaterThan(70000); const R = evaluate({ ...d, a: { ...d.a, ...lenderAssumptions(60000, L, 15).patch } }, {}); near(R.stackTotal, R.ceiling); expect(R.flags.some((f) => f.includes("Roma product"))).toBe(true); });
});
