// Lender terms kept as dated data, separate from the maths. Rates are "from" rates and depend on the case,
// so every figure stays editable on the deal and must be confirmed with a broker or the lender.
export const ROMA = { id: "roma", name: "Roma Finance", source: "Product Guide, July 2026", minLoan: 75000, maxLoan: 3000000,
  // Product depends on works as a share of current market value (CMV)
  products: [
    { name: "FLOW Bridge", maxWorks: 0, rate: 0.87, ltv: 75, ltgdv: null, works: false },
    { name: "FLOW Refurb", maxWorks: 0.25, rate: 0.89, ltv: 70, ltgdv: null, works: true },
    { name: "FLOW Light Development", maxWorks: 0.5, rate: 0.95, ltv: 70, ltgdv: 70, works: true },
    { name: "Medium Refurbishment", maxWorks: 1, rate: 0.98, ltv: 65, ltgdv: 70, works: true },
    { name: "Heavy Refurbishment", maxWorks: Infinity, rate: 0.99, ltv: 65, ltgdv: 70, works: true },
  ], ltc: 0.8 };
export const LENDERS = [ROMA];
// Chooses the product from the works ratio. CMV is taken as the price until a valuer says otherwise
export const romaProduct = (cmv, works) => ROMA.products.find((p) => works / cmv <= p.maxWorks) || ROMA.products[4];
// Overlay applied when a deal picks this lender. Roma's fee matches the 2% default, and the valuation stays a placeholder
export function lenderAssumptions(cmv, refurbLikely, contPct) {
  const works = refurbLikely == null ? 0 : refurbLikely / (1 + contPct / 100), p = romaProduct(cmv || 1, works);
  return { product: p, patch: { lender: "roma", brM: p.rate, ltv: p.ltv, brArr: 2, brTerm: 12, worksPct: p.works ? 100 : 0, lendFees: 600 } };
}
// Roma rules a deal can break. Each one becomes a flag on the report
export function lenderChecks(gross, cmv, gdv, cost, product) {
  const out = [];
  if (gross < ROMA.minLoan) out.push(`The loan of about £${Math.round(gross).toLocaleString("en-GB")} is below Roma's £75,000 minimum`);
  if (product.ltgdv && gross > (product.ltgdv / 100) * gdv) out.push(`The loan is above ${product.ltgdv}% of the worst-case end value`);
  if (product.ltgdv && gross > ROMA.ltc * cost) out.push("The loan is above Roma's 80% loan-to-cost limit");
  return out;
}
