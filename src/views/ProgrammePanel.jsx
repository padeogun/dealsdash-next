// Programme: the plan back to market. Uses the tested 54-activity scheduler, with List and Gantt views on any device.
import React, { useState } from "react";
import { Num, Seg, Section, Text } from "./ui.jsx";
import { ScopeTicks } from "./DealSheet.jsx";
import { TEMPLATE } from "../lib/programme/template.js";
import { fmtDate, validDate } from "../lib/evaluate.js";
const VIEW_KEY = "dealsdash.progview";
const stored = () => { try { return localStorage.getItem(VIEW_KEY); } catch (e) { return null; } };
export function ProgrammePanel({ d, set, R }) {
  const [view, setView] = useState(stored() || (window.innerWidth < 640 ? "list" : "gantt")), [skipped, setSkipped] = useState(false);
  const pick = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* preference only */ } };
  const defs = Object.fromEntries(TEMPLATE.map((t) => [t.id, t]));
  const acts = R.prog ? R.prog.activities.map((a) => ({ ...a, def: defs[a.id] })).filter((a) => skipped || a.applies) : [];
  const setActual = (id, v) => { const next = { ...(d.actuals || {}) }; if (validDate(v)) next[id] = { finish: v }; else delete next[id]; set({ actuals: next }); };
  const phases = [...new Set(acts.map((a) => a.def.phaseName))];
  return <Section title="Programme" summary={R.prog ? `Back on market ${fmtDate(R.prog.keyDates.listed)}` : "Add a date"} open>
    <div className="grid2"><Text id="secured" type="date" label={d.route === "auction" ? "Auction date" : "Offer accepted, or expected"} value={d.secured} onChange={(v) => set({ secured: v })} /><Num id="monthsOverride" label="Months held override" value={d.monthsOverride} onChange={(v) => set({ monthsOverride: v })} placeholder="From programme" /></div>
    {d.refMode === "items" ? <p className="note">Works in scope come from your refurb lines.</p> : <ScopeTicks d={d} set={set} />}
    {R.prog && <><div className="row between"><Seg label="Programme view" value={view} onChange={pick} options={[["list", "List"], ["gantt", "Gantt"]]} /><label className="check"><input type="checkbox" id="showSkipped" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} />Show skipped</label></div>
      {view === "list" ? phases.map((p) => <details key={p}><summary style={{ fontSize: 14 }}>{p}</summary><ul className="plain" style={{ marginTop: 6 }}>{acts.filter((a) => a.def.phaseName === p).map((a) => <li key={a.id} style={{ display: "grid", gap: 4, borderTop: "1px solid var(--vx-divider)", paddingTop: 6 }}><span>{a.def.hold && <b className="s-negotiate">Hold point: </b>}{a.def.name}</span><span className="note">{a.applies ? `${fmtDate(a.start)} to ${fmtDate(a.finish)}, ${a.def.owner}` : "Not in scope"}</span>{a.applies && <label className="hint">Actual finish<input type="date" id={`act-${a.id}`} value={d.actuals?.[a.id]?.finish || ""} onChange={(e) => setActual(a.id, e.target.value)} /></label>}</li>)}</ul></details>) : <Gantt acts={acts} />}
      <p className="note">Enter an actual finish date and later dates move. Durations and logic are illustrative. Holidays use England and Wales dates, so verify them at gov.uk/bank-holidays.</p></>}
  </Section>;
}
// Display only. All dates come from the scheduler, never from drawing code.
function Gantt({ acts }) {
  const on = acts.filter((a) => a.applies), min = Math.min(...on.map((a) => Date.parse(a.start))), max = Math.max(...on.map((a) => Date.parse(a.finish))), span = Math.max(1, max - min), at = (t) => ((t - min) / span) * 100, now = Date.now();
  let last = "";
  return <div className="scroll"><div className="gantt">{on.map((a) => { const head = a.def.phaseName !== last; last = a.def.phaseName; const ms = a.durationUsed === 0; return <React.Fragment key={a.id}>{head && <div className="g-ph">{a.def.phaseName}</div>}<div className="g-row"><span className="g-name" title={a.def.name}>{a.def.name}</span><div className="g-track"><div className={`g-bar ${ms ? "ms" : ""}`} title={`${fmtDate(a.start)} to ${fmtDate(a.finish)}`} style={{ left: `${at(Date.parse(a.start))}%`, width: `${Math.max(0.6, at(Date.parse(a.finish)) - at(Date.parse(a.start)))}%` }} />{now >= min && now <= max && <div className="g-today" style={{ left: `${at(now)}%` }} />}</div></div></React.Fragment>; })}</div></div>;
}
