// Held property logic: compliance status, manual rent ledger and refinance readiness.
// A property with no evidence fails its checks. Blank is unknown, never a pass.
export const REQUIRED_COMPLIANCE = ["Gas Safety Certificate", "EICR (Electrical)", "EPC Certificate", "Deposit Protection", "Right to Rent Check"];
export const COMPLIANCE_TYPES = [...REQUIRED_COMPLIANCE, "PRS Registration", "HMO Licence", "Other"];
const WARN_DAYS = 60;
export function complianceStatus(expiry, today = new Date().toISOString().slice(0, 10)) {
  if (!expiry || Number.isNaN(Date.parse(expiry))) return "Unknown";
  const days = Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000);
  return days < 0 ? "Overdue" : days <= WARN_DAYS ? "Expiring soon" : "Valid";
}
export function rentSummary(ledger = []) {
  const due = ledger.reduce((s, e) => s + (Number(e.due) || 0), 0), received = ledger.reduce((s, e) => s + (Number(e.received) || 0), 0);
  const sorted = [...ledger].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  // Seasoning counts unbroken paid-in-full months back from the latest entry
  let seasoning = 0;
  for (const e of sorted) { if (Number(e.received) >= Number(e.due) && Number(e.due) > 0) seasoning++; else break; }
  return { due, received, arrears: Math.max(0, due - received), seasoning, recentMissed: sorted.slice(0, 6).some((e) => !(Number(e.received) > 0)) };
}
export function readiness(hold = {}, today) {
  const rent = rentSummary(hold.rent), items = hold.compliance || [];
  const missingRequired = REQUIRED_COMPLIANCE.filter((t) => !items.some((i) => i.type === t));
  const bad = items.filter((i) => complianceStatus(i.expiry, today) !== "Valid");
  const checks = [
    { label: "At least 3 months' clean rent history", pass: rent.seasoning >= 3 },
    { label: "No arrears and no missed payments in the last 6 entries", pass: rent.arrears === 0 && !rent.recentMissed && rent.seasoning > 0 },
    { label: `All required compliance items recorded and valid${missingRequired.length ? ` (missing ${missingRequired.length})` : ""}`, pass: !missingRequired.length && !bad.length },
    { label: "EPC rating C or better", pass: ["A", "B", "C"].includes(hold.epc) },
    { label: "Deposit protected and prescribed information served", pass: !!hold.depositDate && !!hold.prescribedInfo },
    { label: "Renters' Rights Act information sheet issued", pass: !!hold.rraSheet },
  ];
  const fails = checks.filter((x) => !x.pass).length;
  return { checks, fails, rent, bad, missingRequired, verdict: fails === 0 ? "Ready" : fails === 1 ? "Almost ready" : "Not ready" };
}
