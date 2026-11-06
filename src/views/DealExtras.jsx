// Smaller deal sections: sold prices, area checks, money on this deal, and linked contacts.
import React, { useState } from "react";
import { useStore } from "../data/store.jsx";
import { Section } from "./ui.jsx";
import { areaChecks, soldPrices } from "../lib/lookups.js";
import { fmtDate, gbp } from "../lib/evaluate.js";
import { dealActuals, MOVEMENTS } from "../lib/portfolio.js";
export function ChecksPanel({ d, set, part }) {
  const { adapter } = useStore(), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const run = async (key, fn) => { setBusy(key); setErr(""); try { const r = await fn(); set(key === "sold" ? { sold: r } : { area_checks: { ...(d.area_checks || {}), ...r } }); } catch (e) { setErr(e.message); } setBusy(""); };
  if (part === "sold") return <div className="stack" style={{ gap: 6 }}><button type="button" className="btn alt" style={{ width: "fit-content" }} disabled={!!busy} onClick={() => run("sold", () => soldPrices(d.postcode))}>{busy ? "Looking up…" : "Find recent sold prices"}</button><p className="note">{err}</p>
    {d.sold?.length > 0 && <details><summary style={{ fontSize: 14 }}>{d.sold.length} recent sales in this district</summary><div className="scroll"><table><tbody>{d.sold.map((s, i) => <tr key={i}><td className="left">{s.address}, {s.postcode}</td><td>{gbp(s.price)}</td><td>{fmtDate(s.date)}</td></tr>)}</tbody></table></div><p className="note">Contains HM Land Registry data © Crown copyright and database right. Licensed under the Open Government Licence v3.0.</p></details>}</div>;
  const a = d.area_checks;
  const planning = async () => { const p = await areaChecks(d.postcode); const r = await adapter.call("planningLookup", { lat: p.lat, lng: p.lng }); return { ...p, planning: r }; };
  return <><div className="row"><button type="button" className="btn alt" disabled={!!busy} onClick={() => run("area", () => areaChecks(d.postcode))}>Check crime and flood</button>{!adapter.demo && <button type="button" className="btn alt" disabled={!!busy} onClick={() => run("area", planning)}>Check planning constraints</button>}{!adapter.demo && <button type="button" className="btn alt" disabled={!!busy} onClick={() => run("area", async () => ({ epc: await adapter.call("epcLookup", { postcode: d.postcode }) }))}>Find EPC</button>}</div><p className="note">{busy ? "Checking…" : err}</p>
    {a && <ul className="plain"><li>{a.district}, {a.country}. Checked {fmtDate(a.checkedAt)}.</li>{a.crime && <li>Crime: {a.crime.error || `${a.crime.total} street-level reports nearby in ${a.crime.month}`}</li>}{a.flood && <li>Flood: {a.flood.error || `${a.flood.areas} Environment Agency flood areas within 3 km`}</li>}
      {a.planning && <li>Planning: {a.planning.found?.length ? a.planning.found.join(", ") : "Nothing returned. This doesn't confirm there is no constraint, because coverage varies"}</li>}{a.epc && <li>EPC: {a.epc.properties?.length ? a.epc.properties.slice(0, 3).map((p) => `${p.address}: ${p.band}`).join("; ") : "No certificates found for this postcode"}</li>}</ul>}</>;
}
export function MoneyPanel({ d }) {
  const { movements } = useStore(), ms = movements.filter((m) => m.dealId === d.id).sort((a, b) => String(b.date).localeCompare(String(a.date))), act = dealActuals(d.id, movements);
  if (!ms.length) return <Section title="Money" summary="Nothing recorded"><p className="note">Record payments in Capital and link them to this deal. Its real result then comes from actual money.</p></Section>;
  return <Section title="Money" summary={`${gbp(act.costs)} spent`}><div className="scroll"><table><tbody>{ms.map((m) => <tr key={m.id}><td className="left">{MOVEMENTS[m.type]?.label}</td><td>{fmtDate(m.date)}</td><td>{gbp(m.amount)}</td></tr>)}</tbody></table></div>{act.hasSale && <p className="note">Actual result: {gbp(act.profit)}</p>}</Section>;
}
export function DealContacts({ d, set }) {
  const { contacts } = useStore(), linked = d.contacts || [];
  return <Section title="Contacts" summary={linked.length ? `${linked.length} linked` : ""}>{contacts.length === 0 ? <p className="note">Add people in Contacts, then link them here.</p> : <ul className="plain">{contacts.map((c) => <li key={c.id}><label className="check"><input type="checkbox" id={`link-${c.id}`} checked={linked.includes(c.id)} onChange={(e) => set({ contacts: e.target.checked ? [...linked, c.id] : linked.filter((x) => x !== c.id) })} />{c.name} <span className="note">{c.type}</span></label></li>)}</ul>}</Section>;
}
