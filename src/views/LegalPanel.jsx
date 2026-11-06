// Legal pack: status, red/amber/green findings, and an optional AI review on the user's own key.
// Fees and findings from a review only apply when the user accepts them.
import React, { useState } from "react";
import { useStore } from "../data/store.jsx";
import { Section, Select, uid } from "./ui.jsx";
const RAG = { R: ["Red", "s-nogo"], A: ["Amber", "s-negotiate"], G: ["Green", "s-go"] };
export function LegalPanel({ d, set }) {
  const { ws, adapter } = useStore(), [text, setText] = useState(""), [rag, setRag] = useState("A"), [busy, setBusy] = useState(""), [review, setReview] = useState(d.legal?.review || null);
  const findings = d.legal?.findings || [], setF = (f) => set({ legal: { ...d.legal, findings: f } });
  const add = () => { if (text.trim()) { setF([...findings, { id: uid(), rag, text: text.trim().slice(0, 300), done: false }]); setText(""); } };
  const run = async (file) => {
    if (file.type !== "application/pdf" || file.size > 40 * 1024 * 1024) { setBusy("Choose a PDF of 40 MB or less."); return; }
    setBusy("Reviewing the pack. This can take a few minutes.");
    try { const path = await adapter.uploadPack(d.id, file), r = await adapter.call("reviewLegalPack", { path, dealId: d.id }); setReview(r); set({ legal: { ...d.legal, review: r } }); setBusy(""); }
    catch (e) { setBusy(String(e.code || "").startsWith("storage/") ? "The upload didn't complete. Try again." : e.message || "The review didn't complete. Try again."); } // Security fix 2026-11-06: raw Storage errors expose bucket paths
  };
  const urgentRag = (u) => (u === "Raise with solicitor before bidding" ? "R" : u === "Worth asking about" ? "A" : "G");
  const accept = (f) => setF([...findings, { id: uid(), rag: urgentRag(f.urgency), text: f.summary.slice(0, 300), done: false, source: "AI review" }]);
  return <Section title="Legal" summary={d.pack || ""}>
    <Select id="pack" label="Legal pack" value={d.pack} onChange={(v) => set({ pack: v })} options={["Not requested", "Requested", "Received", "Reviewed", "Not needed"]} />
    <p className="note">Get auction packs from the auctioneer or your EIG Passport. Their terms limit copying, so the app doesn't import them. Have a solicitor review every pack.</p>
    <ul className="plain">{findings.map((f) => <li key={f.id} className="row" style={{ flexWrap: "nowrap", alignItems: "start" }}><input type="checkbox" aria-label={`Resolved: ${f.text}`} checked={!!f.done} onChange={(e) => setF(findings.map((x) => (x.id === f.id ? { ...x, done: e.target.checked } : x)))} /><b className={RAG[f.rag][1]} style={{ minWidth: 48 }}>{RAG[f.rag][0]}</b><span style={{ flex: 1, textDecoration: f.done ? "line-through" : "none" }}>{f.text}</span><button type="button" className="x" aria-label="Remove finding" onClick={() => setF(findings.filter((x) => x.id !== f.id))}>×</button></li>)}</ul>
    <div className="row" style={{ flexWrap: "nowrap" }}><select id="ragNew" aria-label="Rating" style={{ width: 92 }} value={rag} onChange={(e) => setRag(e.target.value)}><option value="R">Red</option><option value="A">Amber</option><option value="G">Green</option></select><input id="findingNew" aria-label="New finding" placeholder="Add a finding" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /><button type="button" className="btn alt" onClick={add}>Add</button></div>
    <p className="note">Open red findings appear as flags on the report and alerts on Home.</p>
    {ws.ai === "on" && <div className="card" style={{ background: "var(--vx-surface-2)" }}><h3>AI pack review</h3><p className="note">Uses your own API key. It helps triage and doesn't replace your solicitor. The verdict never depends on it.</p>
      <label className="btn alt" style={{ width: "fit-content" }}>Choose legal pack PDF<input type="file" id="packFile" accept="application/pdf" hidden onChange={(e) => e.target.files[0] && run(e.target.files[0])} /></label><p className="note">{busy}</p>
      {review && <><p style={{ margin: 0 }}>{review.tenureSummary}</p><ul className="plain">{(review.flags || []).map((f, i) => <li key={i} className="row between"><span style={{ flex: 1, minWidth: 200 }}><b>{f.urgency}: </b>{f.summary}</span><button type="button" className="btn alt" onClick={() => accept(f)}>Add as finding</button></li>)}</ul>{review.unreadableSections?.length > 0 && <p className="s-negotiate" style={{ margin: 0 }}>Not fully read, so check these yourself: {review.unreadableSections.join("; ")}</p>}
        <p className="note">An AI review doesn't mark the pack as Reviewed. Change the status once your solicitor has reviewed it.</p>
        {review.missingItems?.length > 0 && <p className="note">Not found in the pack: {review.missingItems.join(", ")}</p>}
        {review.additionalFees?.total > 0 && <p className="note">Fees found in the pack total £{Math.round(review.additionalFees.total).toLocaleString("en-GB")}. Check them against your auction fee assumptions.</p>}</>}</div>}
  </Section>;
}
