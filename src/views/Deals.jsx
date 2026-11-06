// Deals: every deal from lead to exit in one list. Adding a lead starts from a pasted link.
import React, { useMemo, useState } from "react";
import { useStore } from "../data/store.jsx";
import { Seg, uid } from "./ui.jsx";
import { evaluate, fmtDate, gbp } from "../lib/evaluate.js";
import { ACTIVE, STAGES } from "../lib/portfolio.js";
import { exampleDeal } from "../data/seed.js";
export function newDeal(ws) { return { id: uid(), stage: "Lead", address: "", postcode: "", nation: "England", route: "auction", strategy: ws.strategy || "flip", sourceUrl: "", source: "Rightmove", pack: "Not requested", price: null, offer: null, vWorst: null, vLikely: null, refMode: "rough", lines: [], area: null, rate: ws.defaults?.rateMedium ?? 400, refLikely: null, refHigh: null, rentWorst: null, rentLikely: null, secured: "", monthsOverride: null, scope: { pre2000: true }, actuals: {}, notes: "", legal: { findings: [] }, contacts: [], area_checks: null, a: { ...ws.defaults }, conf: {}, hold: {} }; }
export function Deals({ go }) {
  const { deals, ws, save } = useStore(), [filter, setFilter] = useState("open");
  const rows = useMemo(() => deals.map((d) => ({ d, R: evaluate(d, ws) })).filter(({ d }) => (filter === "open" ? !["Sold", "Dropped", "Held"].includes(d.stage) : filter === "live" ? ACTIVE.includes(d.stage) : filter === "done" ? ["Sold", "Held", "Dropped"].includes(d.stage) : true)).sort((a, b) => STAGES.indexOf(b.d.stage) - STAGES.indexOf(a.d.stage)), [deals, ws, filter]);
  const add = async () => { const d = newDeal(ws); await save("deals", d); go(`deal:${d.id}`); };
  const example = async () => { const d = { ...exampleDeal(ws.defaults), id: uid() }; await save("deals", d); go(`deal:${d.id}`); };
  return <div className="stack"><div className="row between"><h1>Deals</h1><button id="newDeal" className="btn" onClick={add}>Add lead</button></div>
    <Seg label="Filter" value={filter} onChange={setFilter} options={[["open", "Open"], ["live", "Owned"], ["done", "Closed"], ["all", "All"]]} />
    {rows.length === 0 ? <div className="card"><h2>No deals here yet</h2><p className="note">Add a lead by pasting a Rightmove or auction link, then fill in what you know. You can also load a worked example.</p><div className="row"><button className="btn" onClick={add}>Add lead</button><button className="btn alt" onClick={example}>Load example</button></div></div> :
      <div className="card scroll"><table className="cardify"><thead><tr><th className="left">Deal</th><th className="left">Stage</th><th className="left">Result</th><th>Price</th><th>Ceiling</th><th>Back on market</th></tr></thead><tbody>{rows.map(({ d, R }) => <tr key={d.id} className="dealrow"><td><button className="link" onClick={() => go(`deal:${d.id}`)}>{d.address || "Untitled deal"}</button></td><td className="left">{d.stage}</td><td className="left"><span className={`pill s-${R.status}`}>{R.word}</span></td><td>{gbp(d.offer ?? d.price)}</td><td>{R.ceiling != null ? gbp(R.ceiling) : "-"}</td><td>{R.prog ? fmtDate(R.prog.keyDates.listed) : "-"}</td></tr>)}</tbody></table></div>}
    <LeadResearch /></div>;
}
// Optional AI lead research on the user's own key. Results are unverified, so they stay out of Deals until added.
function LeadResearch() {
  const { ws, adapter, save } = useStore(), [q, setQ] = useState(""), [busy, setBusy] = useState(""), [leads, setLeads] = useState([]);
  if (ws.ai !== "on") return null;
  const run = async () => { setBusy("Searching. This can take a few minutes."); try { const r = await adapter.call("researchLeads", { criteria: q.slice(0, 1000) }); setLeads(r.leads || []); setBusy(r.leads?.length ? "" : "Nothing found. Try a wider search."); } catch (e) { setBusy(e.message); } };
  const addLead = async (l) => { const d = { ...newDeal(ws), address: l.address || "", postcode: l.postcode || "", price: l.guidePrice || null, sourceUrl: /^https?:\/\//.test(l.sourceUrl || "") ? l.sourceUrl : "", source: "Other", notes: "Found by AI research. Check it's still available." }; await save("deals", d); setLeads(leads.filter((x) => x !== l)); };
  return <div className="card"><h2>AI lead research</h2><p className="note">Optional, on your own API key. Check every result, as listings may be out of date.</p><label>What are you looking for?<textarea id="research" maxLength={1000} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Terraced houses under £90k in Oldham needing refurbishment" /></label><div className="row"><button className="btn alt" disabled={!q.trim()} onClick={run}>Search</button><span className="note">{busy}</span></div><ul className="plain">{leads.map((l, i) => <li key={i} className="row between"><span>{l.address}, {gbp(l.guidePrice)}</span><button className="btn alt" onClick={() => addLead(l)}>Add to Deals</button></li>)}</ul></div>;
}
