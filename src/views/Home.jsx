// Home: business health and risk on one page. Every figure is derived, so nothing is entered here.
import React, { useMemo } from "react";
import { useStore } from "../data/store.jsx";
import { Alerts, Stat } from "./ui.jsx";
import { portfolio } from "../lib/portfolio.js";
import { fmtDate, gbp, pct } from "../lib/evaluate.js";
export function Home({ go }) {
  const { ws, deals, movements, facilities } = useStore(), p = useMemo(() => portfolio(deals, movements, facilities, ws), [deals, movements, facilities, ws]);
  return <div className="stack"><h1>{ws.name}</h1>
    <div className="stats"><Stat value={gbp(p.cash)} label="Cash in the bank" /><Stat value={gbp(p.available)} label="Available after live deals" /><Stat value={p.runway == null ? "Not set" : `${p.runway.toFixed(1)} mo`} label="Runway at your overheads" /><Stat value={gbp(p.realised)} label="Realised profit" /></div>
    <div className="card"><h2>Needs attention</h2><Alerts items={p.alerts} go={go} /></div>
    <div className="cols two">
      <div className="card"><div className="row between"><h2>Deals you own</h2><button className="link" onClick={() => go("deals")}>All deals</button></div>{p.active.length === 0 ? <p className="note">No live deals yet.</p> : <div className="scroll"><table><thead><tr><th>Deal</th><th>Stage</th><th>Next date</th><th>Cash need</th></tr></thead><tbody>{p.active.map(({ d, R }) => <tr key={d.id}><td><button className="link" onClick={() => go(`deal:${d.id}`)}>{d.address}</button></td><td>{d.stage}</td><td>{R.prog ? fmtDate(d.stage === "Secured" ? R.prog.keyDates.completion : d.stage === "Refurb" ? R.prog.keyDates.pc : R.prog.keyDates.saleCompleted) : "-"}</td><td>{gbp(R.cash)}</td></tr>)}</tbody></table></div>}</div>
      <div className="card"><h2>Risk exposure</h2><div className="scroll"><table><tbody><tr><td>Debt against your capital</td><td>{p.leverage == null ? "No capital recorded" : `${p.leverage.toFixed(2)} times`}</td></tr><tr><td>Bridge debt</td><td>{gbp(p.bridgeDebt)}</td></tr><tr><td>Private lender debt</td><td>{gbp(p.lenderDebt)}</td></tr><tr><td>Largest area share</td><td>{p.concentration ? `${pct(p.concentration.share)} in ${p.concentration.area}` : "-"}</td></tr></tbody></table></div>
        {p.active.length > 0 && <div className="scroll"><table><thead><tr><th>Deal</th><th>Worst case, high refurb</th><th>Red legal items</th><th>Area checks</th></tr></thead><tbody>{p.active.map(({ d, R }) => <tr key={d.id}><td>{d.address}</td><td>{R.worstHighMargin != null ? pct(R.worstHighMargin) : "Unknown"}</td><td>{(d.legal?.findings || []).filter((f) => f.rag === "R" && !f.done).length}</td><td>{d.area_checks ? "Done" : "Not done"}</td></tr>)}</tbody></table></div>}</div>
    </div>
    {p.held.length > 0 && <div className="card"><h2>Held properties</h2><div className="scroll"><table><thead><tr><th>Property</th><th>Rent</th><th>Refinance readiness</th></tr></thead><tbody>{p.held.map(({ d, ready }) => <tr key={d.id}><td><button className="link" onClick={() => go(`deal:${d.id}`)}>{d.address}</button></td><td>{gbp(d.hold?.monthlyRent)}</td><td>{ready.verdict}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
