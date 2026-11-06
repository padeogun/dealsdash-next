// The Deal Sheet: one place to enter a deal, with the go/no-go report beside it.
// Each section opens up into more detail, so a first pass needs only the basics.
import React, { useMemo, useRef, useState, useEffect } from "react";
import { useStore } from "../data/store.jsx";
import { Num, Text, Select, Seg, Section } from "./ui.jsx";
import { evaluate } from "../lib/evaluate.js";
import { STAGES } from "../lib/portfolio.js";
import { ASSUMPTIONS } from "../lib/engine/assumptions.js";
import { SCOPE_LABELS } from "../lib/refurb.js";
import { lenderAssumptions } from "../lib/engine/lenders.js";
import { Report } from "./Report.jsx";
import { RefurbLines } from "./RefurbLines.jsx";
import { ProgrammePanel } from "./ProgrammePanel.jsx";
import { LegalPanel } from "./LegalPanel.jsx";
import { HoldPanel } from "./HoldPanel.jsx";
import { ChecksPanel, MoneyPanel, DealContacts } from "./DealExtras.jsx";

export function DealSheet({ id, go }) {
  const { deals, ws, save, remove } = useStore();
  const stored = deals.find((x) => x.id === id);
  const [d, setD] = useState(stored), timer = useRef(null), [confirm, setConfirm] = useState(false);
  useEffect(() => { setD(stored); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Edits apply at once on screen and save shortly after typing stops
  const set = (patch) => setD((cur) => { const next = { ...cur, ...patch }; clearTimeout(timer.current); timer.current = setTimeout(() => save("deals", next), 500); return next; });
  useEffect(() => () => clearTimeout(timer.current), []);
  const R = useMemo(() => (d ? evaluate(d, ws) : null), [d, ws]);
  if (!d) return <p className="note">This deal no longer exists. <button className="link" onClick={() => go("deals")}>Back to Deals</button></p>;
  const m = ws.modules || {};
  const setUrl = (v) => { const u = v.toLowerCase(), p = { sourceUrl: v }; if (u.includes("rightmove.co.uk")) p.source = "Rightmove"; if (u.includes("eigpropertyauctions")) { p.source = "EIG"; p.route = "auction"; } set(p); };
  return <>
    <div id="strip" className="wrap" aria-live="polite"><span className={`s-${R.status}`}>{R.word}</span><span>{R.status === "incomplete" ? `${R.missing.length} to fill` : `Ceiling £${Math.round(R.ceiling).toLocaleString("en-GB")}`}</span></div>
    <div className="cols sheet" style={{ marginTop: 12 }}>
      <form className="stack" onSubmit={(e) => e.preventDefault()} autoComplete="off">
        <div className="row between"><button type="button" className="link" onClick={() => go("deals")}>Back to Deals</button><Select id="stage" value={d.stage} onChange={(v) => set({ stage: v })} options={STAGES} /></div>
        <Section title="The deal" open>
          <Text id="sourceUrl" label="Listing link" value={d.sourceUrl} onChange={setUrl} max={500} placeholder="Paste a Rightmove or auction page link" hint="The app saves the link only. It doesn't read the listing, so add the details below." />
          <Text id="address" label="Address" value={d.address} onChange={(v) => set({ address: v })} />
          <div className="grid2"><Text id="postcode" label="Postcode" value={d.postcode} onChange={(v) => set({ postcode: v })} max={10} /><Select id="nation" label="Nation" value={d.nation} onChange={(v) => set({ nation: v })} options={["England", "Northern Ireland", "Scotland", "Wales"]} /></div>
          <div className="row"><Seg label="Strategy" value={d.strategy} onChange={(v) => set({ strategy: v })} options={[["flip", "Flip"], ["brrr", "BRRR"]]} /><Seg label="Route" value={d.route} onChange={(v) => set({ route: v })} options={[["auction", "Auction"], ["agent", "Agent"]]} /></div>
          <div className="grid2"><Num id="price" label={d.route === "auction" ? "Guide price £" : "Asking price £"} value={d.price} onChange={(v) => set({ price: v })} /><Num id="offer" label="Test another price £" value={d.offer} onChange={(v) => set({ offer: v })} placeholder="Optional" /></div>
          <Select id="source" label="Source" value={d.source} onChange={(v) => set({ source: v })} options={["Rightmove", "Auction site", "EIG", "Estate agent", "Other"]} />
        </Section>
        <Section title="End value" open>
          <div className="grid2"><Num id="vWorst" label="Worst case £" value={d.vWorst} onChange={(v) => set({ vWorst: v })} /><Num id="vLikely" label="Likely £" value={d.vLikely} onChange={(v) => set({ vLikely: v })} /></div>
          <p className="note">The verdict always uses the worst case.</p>
          {m.checks !== false && <ChecksPanel d={d} set={set} part="sold" />}
          {d.strategy === "brrr" && <div className="grid2"><Num id="rentWorst" label="Rent, cautious £ a month" value={d.rentWorst} onChange={(v) => set({ rentWorst: v })} /><Num id="rentLikely" label="Rent, likely £ a month" value={d.rentLikely} onChange={(v) => set({ rentLikely: v })} /></div>}
        </Section>
        <Section title="Refurb" summary={R.ref.likely != null ? `£${Math.round(R.ref.likely).toLocaleString("en-GB")} likely, £${Math.round(R.ref.high).toLocaleString("en-GB")} high` : ""} open>
          <Seg label="Refurb detail" value={d.refMode} onChange={(v) => set({ refMode: v })} options={[["rough", "Rough £/m²"], ["total", "Total figure"], ["items", "Line by line"]]} />
          {d.refMode === "rough" && <><div className="grid2"><Num id="area" label="Floor area m²" value={d.area} onChange={(v) => set({ area: v })} /><Num id="rate" label="Rate £/m²" value={d.rate} onChange={(v) => set({ rate: v })} /></div>
            <Seg label="Rate preset" value={d.rate} onChange={(v) => set({ rate: v })} options={[[d.a.rateLight, `Light £${d.a.rateLight}`], [d.a.rateMedium, `Medium £${d.a.rateMedium}`], [d.a.rateHeavy, `Heavy £${d.a.rateHeavy}`]]} /><p className="note">Change the preset rates under Assumptions. They are placeholders until you have contractor rates.</p></>}
          {d.refMode === "total" && <div className="grid2"><Num id="refLikely" label="Likely, with contingency £" value={d.refLikely} onChange={(v) => set({ refLikely: v })} /><Num id="refHigh" label="High, with contingency £" value={d.refHigh} onChange={(v) => set({ refHigh: v })} placeholder="Estimated if blank" /></div>}
          {d.refMode === "items" && <RefurbLines d={d} set={set} ref_={R.ref} />}
        </Section>
        <ProgrammePanel d={d} set={set} R={R} />
        {m.legal !== false && <LegalPanel d={d} set={set} />}
        {m.checks !== false && <Section title="Area checks"><ChecksPanel d={d} set={set} part="area" /></Section>}
        <MoneyPanel d={d} />
        {m.contacts !== false && <DealContacts d={d} set={set} />}
        {m.hold !== false && (d.strategy === "brrr" || d.stage === "Held") && <HoldPanel d={d} set={set} />}
        <Section title="Open items"><label><span className="hint">One per line. These print on the PDF.</span><textarea id="notes" maxLength={2000} value={d.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></label></Section>
        <Assumptions d={d} set={set} />
        <div className="row">{confirm ? <><span className="note">Delete this deal and its programme?</span><button type="button" className="btn danger" onClick={() => { remove("deals", d.id); go("deals"); }}>Delete deal</button><button type="button" className="btn alt" onClick={() => setConfirm(false)}>Keep it</button></> : <button type="button" className="btn alt" onClick={() => setConfirm(true)}>Delete deal</button>}</div>
      </form>
      <aside><Report d={d} R={R} /></aside>
    </div></>;
}
// Only the assumptions this deal uses are shown. Editing one marks it confirmed.
function Assumptions({ d, set }) {
  // Choosing a lender loads its published terms, marked Assumed until you've had them confirmed
  const pick = (v) => { if (v === "") { const { lender, ...a } = d.a; set({ a: { ...a, lender: "" } }); return; } const c = d.a; const likely = d.refMode === "items" ? (d.lines || []).filter((l) => l.on).reduce((s, l) => s + (l.likely || 0), 0) * (1 + c.cont / 100) : d.refMode === "total" ? d.refLikely : (d.area || 0) * (d.rate || 0) * (1 + c.cont / 100); set({ a: { ...c, ...lenderAssumptions(d.offer ?? d.price, likely, c.cont).patch } }); };
  const used = ASSUMPTIONS.filter(([k, , , , g]) => (g !== "BRRR" || d.strategy === "brrr") && (g !== "Auction fees" || d.route === "auction") && (g !== "Sale" || d.strategy === "flip") && !(k === "mFlip" && d.strategy === "brrr") && !(k === "mBrrr" && d.strategy === "flip") && (g !== "Lender terms" || d.a.lender) && (!k.startsWith("rate") || d.refMode === "rough"));
  const n = used.filter((a) => d.conf?.[a[0]]).length; let last = "";
  return <Section title="Assumptions" summary={`${n} of ${used.length} confirmed`}><Select id="lender" label="Bridge lender" value={d.a.lender || ""} onChange={pick} options={[["", "Generic terms"], ["roma", "Roma Finance (Product Guide, July 2026)"]]} />{used.map(([k, l, , u, g, src]) => { const head = g !== last; last = g; const on = !!d.conf?.[k]; return <React.Fragment key={k}>{head && <h3 className="group">{g}</h3>}<div className="arow"><label htmlFor={`a-${k}`}>{l}{u !== "n" && ` (${u})`}<span className="src">{src}</span></label><Num id={`a-${k}`} value={d.a[k]} onChange={(v) => { if (v == null) return; const p = { a: { ...d.a, [k]: v }, conf: { ...d.conf, [k]: true } }; if (k.startsWith("rate") && d.rate === d.a[k]) p.rate = v; set(p); }} /><button type="button" className="chip" aria-pressed={on} onClick={() => set({ conf: { ...d.conf, [k]: !on } })}>{on ? "Confirmed" : "Assumed"}</button></div></React.Fragment>; })}</Section>;
}
export const ScopeTicks = ({ d, set }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "2px 12px" }}>{SCOPE_LABELS.map(([k, l]) => <label className="check" key={k}><input type="checkbox" id={`scope-${k}`} checked={!!d.scope?.[k]} onChange={(e) => set({ scope: { ...d.scope, [k]: e.target.checked } })} />{l}</label>)}</div>;
