// The one list of editable assumptions. Setup holds the defaults and each deal keeps its own copy.
// Row shape: [key, label, default, unit, group, source note]. Percentages are held as entered (20 = 20%).
// Every default is illustrative until the user confirms it on a deal.
export const ASSUMPTIONS = [
  ["target", "Profit target", 20, "%", "Your rules", "Share of worst-case value"],
  ["maxGap", "Negotiate range above ceiling", 15, "%", "Your rules", "Placeholder: beyond this is No-go"],
  ["keepIn", "Cash left in accepted", 10000, "£", "BRRR", "Your decision"],
  ["minCf", "Minimum monthly cash flow", 150, "£", "BRRR", "Illustrative"],
  ["bpRate", "Buyer's premium rate", 2.5, "%", "Auction fees", "Check the legal pack"],
  ["bpMin", "Buyer's premium minimum", 5500, "£", "Auction fees", "Check the legal pack"],
  ["sLegal", "Seller's legal costs", 1320, "£", "Auction fees", "Check the legal pack"],
  ["sDisb", "Seller's disbursements", 450, "£", "Auction fees", "Estimate"],
  ["sBank", "Seller's transfer fees", 60, "£", "Auction fees", "Check the legal pack"],
  ["ownLegal", "Your conveyancing", 1800, "£", "Buying", "Get a quote"],
  ["searches", "Searches", 450, "£", "Buying", "Estimate"],
  ["lendFees", "Lender legal and valuation", 1200, "£", "Buying", "Estimate"],
  ["ltv", "Bridge advance of price", 70, "%", "Finance", "Check against your agreement in principle"],
  ["brM", "Bridge interest per month", 0.85, "%", "Finance", "Estimate"],
  ["brArr", "Bridge arrangement fee", 2, "%", "Finance", "Estimate"],
  ["plRate", "Private lender rate per year", 8, "%", "Finance", "Your lender terms"],
  ["draw", "Refurb outstanding on average", 50, "%", "Finance", "Estimate"],
  ["mFlip", "Months held, flip, if no programme", 7, "n", "Time and holding", "Used until a date is entered"],
  ["mBrrr", "Months held to refinance", 5, "n", "Time and holding", "Check lender policy"],
  ["hold", "Holding costs per month", 350, "£", "Time and holding", "Estimate"],
  ["agentFee", "Estate agent fee", 1.8, "%", "Sale", "1.5% + VAT"],
  ["saleLegal", "Sale conveyancing", 1200, "£", "Sale", "Estimate"],
  ["refiLtv", "Refinance LTV", 75, "%", "BRRR", "Check with broker"],
  ["refiFees", "Refinance costs", 2000, "£", "BRRR", "Estimate"],
  ["mortR", "Mortgage rate", 5.5, "%", "BRRR", "Check with broker"],
  ["mgmt", "Letting management", 12, "%", "BRRR", "Estimate"],
  ["maint", "Maintenance and voids", 10, "%", "BRRR", "Estimate"],
  ["ins", "Landlord insurance per month", 30, "£", "BRRR", "Estimate"],
  ["cont", "Refurb contingency", 15, "%", "Refurb", "Illustrative"],
  ["highX", "High refurb as % of likely", 140, "%", "Refurb", "Used when no high figure exists"],
  ["rateLight", "Light refurb rate per m²", 250, "£", "Refurb", "Placeholder: use contractor rates"],
  ["rateMedium", "Medium refurb rate per m²", 400, "£", "Refurb", "Placeholder: use contractor rates"],
  ["rateHeavy", "Heavy refurb rate per m²", 650, "£", "Refurb", "Placeholder: use contractor rates"],
  ["progAuction", "Auction to completion, calendar days", 28, "n", "Programme", "Check the legal pack"],
  ["progAgent", "Agent: exchange to completion, working days", 10, "n", "Programme", "Illustrative"],
  ["progAgree", "Working days to agree a sale", 30, "n", "Programme", "Illustrative"],
  ["progSale", "Sale: exchange to completion, working days", 10, "n", "Programme", "Illustrative"],
  ["progRetain", "Retention release, working days", 60, "n", "Programme", "Illustrative"],
  ["progCont", "Programme contingency", 15, "%", "Programme", "Illustrative"],
  ["progWinter", "Winter drying allowance, working days", 3, "n", "Programme", "Illustrative"],
];
const PCT = new Set(ASSUMPTIONS.filter((a) => a[3] === "%").map((a) => a[0]));
export const defaultAssumptions = () => Object.fromEntries(ASSUMPTIONS.map((a) => [a[0], a[2]]));
// Entered percentages become fractions for the maths. Missing keys fall back to defaults.
export function toConfig(a) {
  const merged = { ...defaultAssumptions(), ...(a || {}) }, c = {};
  for (const k in merged) c[k] = PCT.has(k) ? merged[k] / 100 : merged[k];
  return c;
}
