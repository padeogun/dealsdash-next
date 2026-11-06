// Line-by-line refurb: low, likely and high per item, with a tick for what is in scope.
// Tagged lines also set the programme, so scope is only entered once.
import React from "react";
import { Num } from "./ui.jsx";
import { gbp, pct } from "../lib/evaluate.js";
import { newLine, starterLines, SCOPE_LABELS } from "../lib/refurb.js";
import { toConfig } from "../lib/engine/assumptions.js";
export function RefurbLines({ d, set, ref_ }) {
  const lines = d.lines || [], c = toConfig(d.a);
  const up = (id, p) => set({ lines: lines.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  return <div className="lines">
    {lines.length === 0 && <div className="row"><p className="note">Start from a list of common items, or add your own.</p><button type="button" className="btn alt" onClick={() => set({ lines: starterLines() })}>Use starter list</button></div>}
    {lines.length > 0 && <div className="line head"><span /><span className="nm" style={{ textAlign: "left" }}>Item (£, before contingency)</span><span>Low</span><span>Likely</span><span>High</span><span /></div>}
    {lines.map((l) => <div key={l.id} className={`line ${l.on ? "" : "off"}`}>
      <input type="checkbox" id={`on-${l.id}`} aria-label={`Include ${l.name}`} checked={!!l.on} onChange={(e) => up(l.id, { on: e.target.checked })} />
      <span className="nm" style={{ display: "grid", gap: 2 }}><input type="text" id={`nm-${l.id}`} aria-label="Item name" value={l.name} maxLength={120} onChange={(e) => up(l.id, { name: e.target.value })} />
        <select id={`sc-${l.id}`} aria-label="Programme work" value={l.scope || ""} style={{ minHeight: 28, padding: "1px 4px", fontSize: 12 }} onChange={(e) => up(l.id, { scope: e.target.value })}><option value="">No programme link</option>{SCOPE_LABELS.slice(1).map(([k, t]) => <option key={k} value={k}>Programme: {t}</option>)}</select></span>
      {["low", "likely", "high"].map((k) => <Num key={k} id={`${k}-${l.id}`} value={l[k]} onChange={(v) => up(l.id, { [k]: v })} />)}
      <button type="button" className="x" aria-label={`Remove ${l.name}`} onClick={() => set({ lines: lines.filter((x) => x.id !== l.id) })}>×</button></div>)}
    <div className="row between"><button type="button" className="btn alt" onClick={() => set({ lines: [...lines, newLine()] })}>Add item</button>
      {ref_.likely != null && <span className="note">With {pct(c.cont)} contingency: low {gbp(ref_.low)}, likely {gbp(ref_.likely)}, high {gbp(ref_.high)}</span>}</div>
    <label className="check"><input type="checkbox" id="pre2000" checked={!!d.scope?.pre2000} onChange={(e) => set({ scope: { ...d.scope, pre2000: e.target.checked } })} />Built before 2000 (adds asbestos survey to the programme)</label>
  </div>;
}
