// Hold: tenancy, compliance, the manual rent ledger and refinance readiness, all on the deal itself.
// Rent collection and bank matching are left to dedicated tools.
import React from "react";
import { Num, Section, Select, Text, today, uid } from "./ui.jsx";
import { COMPLIANCE_TYPES, complianceStatus, readiness } from "../lib/hold.js";
import { gbp } from "../lib/evaluate.js";
const TONE = { Valid: "s-go", "Expiring soon": "s-negotiate", Overdue: "s-nogo", Unknown: "s-incomplete" };
export function HoldPanel({ d, set }) {
  const h = d.hold || {}, up = (p) => set({ hold: { ...h, ...p } }), r = readiness(h), comp = h.compliance || [], rent = h.rent || [];
  const uc = (id, p) => up({ compliance: comp.map((x) => (x.id === id ? { ...x, ...p } : x)) }), ur = (id, p) => up({ rent: rent.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  return <Section title="Hold" summary={`Refinance: ${r.verdict}`}>
    <h3>Tenancy</h3><p className="note">Tenancies are periodic under the Renters' Rights Act, so there is no fixed-term date to track.</p>
    <div className="grid2"><Text id="tenant" label="Tenant" value={h.tenant} onChange={(v) => up({ tenant: v })} /><Text id="tenStart" type="date" label="Start date" value={h.start} onChange={(v) => up({ start: v })} /><Num id="monthlyRent" label="Monthly rent £" value={h.monthlyRent} onChange={(v) => up({ monthlyRent: v })} /><Select id="epc" label="EPC rating" value={h.epc || "Unknown"} onChange={(v) => up({ epc: v })} options={["Unknown", "A", "B", "C", "D", "E", "F", "G"]} /><Num id="deposit" label="Deposit £" value={h.deposit} onChange={(v) => up({ deposit: v })} /><Text id="depositDate" type="date" label="Deposit protected on" value={h.depositDate} onChange={(v) => up({ depositDate: v })} /></div>
    <label className="check"><input type="checkbox" id="prescribed" checked={!!h.prescribedInfo} onChange={(e) => up({ prescribedInfo: e.target.checked })} />Prescribed information served</label>
    <label className="check"><input type="checkbox" id="rra" checked={!!h.rraSheet} onChange={(e) => up({ rraSheet: e.target.checked })} />Renters' Rights Act information sheet issued</label>
    <h3>Compliance</h3>{comp.map((c) => { const s = complianceStatus(c.expiry); return <div key={c.id} className="row" style={{ flexWrap: "nowrap" }}><select aria-label="Type" value={c.type} onChange={(e) => uc(c.id, { type: e.target.value })}>{COMPLIANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select><input type="date" aria-label="Expiry date" value={c.expiry || ""} onChange={(e) => uc(c.id, { expiry: e.target.value })} /><b className={TONE[s]} style={{ fontSize: 13, minWidth: 64 }}>{s}</b><button type="button" className="x" aria-label="Remove" onClick={() => up({ compliance: comp.filter((x) => x.id !== c.id) })}>×</button></div>; })}
    <button type="button" className="btn alt" style={{ width: "fit-content" }} onClick={() => up({ compliance: [...comp, { id: uid(), type: COMPLIANCE_TYPES[0], expiry: "" }] })}>Add compliance item</button>
    <h3>Rent ledger</h3><p className="note">A manual record of rent due and received, kept as evidence. {gbp(r.rent.arrears)} arrears, {r.rent.seasoning} clean months.</p>
    {rent.map((e) => <div key={e.id} className="row" style={{ flexWrap: "nowrap" }}><input type="date" aria-label="Date" value={e.date || ""} onChange={(ev) => ur(e.id, { date: ev.target.value })} /><Num id={`due-${e.id}`} value={e.due} onChange={(v) => ur(e.id, { due: v })} placeholder="Due" /><Num id={`rec-${e.id}`} value={e.received} onChange={(v) => ur(e.id, { received: v })} placeholder="Received" /><button type="button" className="x" aria-label="Remove" onClick={() => up({ rent: rent.filter((x) => x.id !== e.id) })}>×</button></div>)}
    <button type="button" className="btn alt" style={{ width: "fit-content" }} onClick={() => up({ rent: [...rent, { id: uid(), date: today(), due: h.monthlyRent ?? null, received: null }] })}>Add rent entry</button>
    <h3>Refinance readiness: {r.verdict}</h3><ul className="plain">{r.checks.map((c) => <li key={c.label}><b className={c.pass ? "s-go" : "s-nogo"} style={{ display: "inline-block", minWidth: 40 }}>{c.pass ? "Pass" : "Fail"}</b>{c.label}</li>)}</ul>
  </Section>;
}
