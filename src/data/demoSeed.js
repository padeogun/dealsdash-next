// Example data for the demo build and tests only. Figures come from the illustrative 779 Ashton Road v2
// workbook. The live app never imports this file, so this deal is not in the production bundle.
import { defaultAssumptions } from "../lib/engine/assumptions.js";
import { freshWorkspace } from "./seed.js";
const L = (name, scope, low, likely, high, on = true) => ({ id: "ash-" + name.replace(/\W+/g, "").toLowerCase(), name, scope, low, likely, high, on });
export const ashtonLines = () => [
  L("Roof overhaul", "roofExternal", 1500, 2500, 4000), L("Rebuild missing gable outer leaf", "structural", 5000, 6500, 8000), L("Kitchen refresh", "kitchen", 1800, 2800, 4000), L("Bathroom reline and refresh", "bathroom", 1500, 2300, 3200),
  L("Painting and decorating", "", 3500, 4800, 6500), L("Consumer unit and EICR", "", 700, 1100, 1500), L("Gas safety and boiler service", "", 100, 140, 200), L("Scaffold", "", 2000, 2800, 3800), L("Skips and waste", "", 900, 1300, 1800),
  L("Structural engineer", "", 600, 1000, 1600), L("Building Control", "", 300, 600, 1000), L("Making good and plastering", "", 1000, 1800, 3000), L("Asbestos survey", "", 250, 350, 500), L("Loft insulation", "", 350, 550, 800),
  L("Highways scaffold licence", "", 300, 650, 1000), L("Overhead cable shrouding", "", 0, 400, 800), L("Graffiti, frontage and boarded opening", "", 750, 1250, 1800), L("Flooring", "", 2500, 3500, 4500),
  L("Full re-roof", "roofExternal", 6500, 8500, 11500, false), L("New en-suite", "", 5500, 7500, 10000, false), L("Full rewire if EICR fails", "rewire", 4000, 5750, 7500, false), L("Damp and timber treatment", "dampTimber", 1500, 2750, 4000, false),
];
export const ashtonDeal = (a = defaultAssumptions()) => ({
  id: "ashton", stage: "Legal", address: "779 Ashton Road, Oldham", postcode: "OL8 2RJ", nation: "England", route: "auction", strategy: "flip", sourceUrl: "https://www.rightmove.co.uk/properties/94528245", source: "Rightmove", pack: "Reviewed",
  price: 60000, offer: null, vWorst: 150000, vLikely: 165000, refMode: "items", lines: ashtonLines(), area: 86, rate: 400, refLikely: null, refHigh: null, rentWorst: 1000, rentLikely: 1050,
  secured: "2026-11-12", monthsOverride: null, scope: { pre2000: true }, actuals: {}, notes: "Deposit terms from Edward Mellor\nBridge agreement in principle for 20-working-day completion",
  legal: { findings: [{ id: "f1", rag: "R", text: "Engineer to inspect the gable before bidding", done: false }, { id: "f2", rag: "R", text: "No searches in pack: order them, including coal mining", done: false }, { id: "f3", rag: "A", text: "Title plan covers the house footprint only, so scaffold may need access", done: false }, { id: "f4", rag: "G", text: "999-year lease with fixed £5 ground rent", done: true }] },
  contacts: [], area_checks: null, a: { ...a }, conf: { target: true, bpRate: true, bpMin: true, sLegal: true, sBank: true, plRate: true }, hold: {},
});
export const demoWorkspace = () => ({ ...freshWorkspace("Example business"), coreAreas: [{ code: "E08000004", name: "Oldham", postcodes: ["OL1", "OL2", "OL3", "OL4", "OL8", "OL9"] }, { code: "E08000005", name: "Rochdale", postcodes: ["OL11", "OL12", "OL16"] }], nonWork: "2026-12-29, 2026-12-30, 2026-12-31, 2027-12-29, 2027-12-30, 2027-12-31", monthlyOverhead: 500 });
export const demoData = () => ({ deals: [ashtonDeal()], movements: [{ id: "m1", date: "2026-10-20", type: "equity_in", amount: 20000, note: "Example opening capital" }], contacts: [{ id: "c1", name: "Example solicitor", company: "", category: "Professional", type: "Solicitor / conveyancer", status: "Untested", phone: "", email: "", area: "Greater Manchester", notes: "Example entry" }], facilities: [{ id: "fac1", name: "Example lender pool", size: 50000, rate: 8, term: 12 }] });
