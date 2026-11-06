// Setup: one set of rules for the workspace, which modules appear, and whether AI is on.
// An API key goes straight to the server. It is never kept in the browser or shown again.
import React, { useEffect, useState } from "react";
import { useStore } from "../data/store.jsx";
import { Num, Seg, Text } from "./ui.jsx";
import { ASSUMPTIONS } from "../lib/engine/assumptions.js";
const MODULES = [["capital", "Capital"], ["areas", "Areas"], ["contacts", "Contacts"], ["legal", "Legal"], ["checks", "Sold prices and area checks"], ["hold", "Hold (rent, compliance, refinance)"]];
export function Setup({ go }) {
  const { ws, saveWorkspace, adapter, deals, movements, contacts, facilities } = useStore(), [confirm, setConfirm] = useState("");
  const a = ws.defaults || {}, m = ws.modules || {};
  const exportData = async () => { const name = "dealsdash-export.json", body = JSON.stringify({ workspace: ws, deals, movements, contacts, facilities }, null, 1); const dl = adapter.demo && window.claude?.use ? await window.claude.use("downloads") : null; if (dl) { await dl.save({ filename: name, data: body }); return; } const url = URL.createObjectURL(new Blob([body], { type: "application/json" })), l = document.createElement("a"); l.href = url; l.download = name; l.click(); URL.revokeObjectURL(url); };
  let last = "";
  return <div className="stack" style={{ maxWidth: 760 }}><h1>Setup</h1>
    <div className="card"><Text id="wsName" label="Business name on reports" value={ws.name} onChange={(v) => saveWorkspace({ name: v })} max={80} />
      <div><label>Default strategy</label><Seg label="Default strategy" value={ws.strategy} onChange={(v) => saveWorkspace({ strategy: v })} options={[["flip", "Flip"], ["brrr", "BRRR"]]} /><p className="note">New deals start on this. Any deal can switch.</p></div>
      <div><label>Core areas</label><p className="note">{(ws.coreAreas || []).map((x) => x.name).join(", ") || "None yet."} <button className="link" onClick={() => go("areas")}>Choose in Areas</button>. A deal outside these gets a flag.</p></div>
      <div><label>Stamp duty treatment</label><Seg label="Buyer" value={ws.buyer || "company"} onChange={(v) => saveWorkspace({ buyer: v })} options={[["company", "Company or additional property"], ["individual", "Standard rates"]]} /><p className="note">First-time buyer relief is never applied. Verify rates on GOV.UK.</p></div>
      <div style={{ maxWidth: 280 }}><Num id="overhead" label="Business overheads per month £" value={ws.monthlyOverhead} onChange={(v) => saveWorkspace({ monthlyOverhead: v ?? 0 })} /></div>
      <Text id="nonWork" label="Non-working days" value={ws.nonWork} max={500} onChange={(v) => saveWorkspace({ nonWork: v })} hint="Trade shutdowns and crew holidays as YYYY-MM-DD, separated by commas. Bank holidays are already included." /></div>
    <div className="card"><h2>Modules</h2><p className="note">Turn off anything you don't use. Your data is kept.</p>{MODULES.map(([k, l]) => <label className="check" key={k}><input type="checkbox" id={`mod-${k}`} checked={m[k] !== false} onChange={(e) => saveWorkspace({ modules: { ...m, [k]: e.target.checked } })} />{l}</label>)}</div>
    <AiSetup />
    <div className="card"><h2>Your rules and default assumptions</h2><p className="note">These apply to new deals. Open deals keep their own figures. Every default is a placeholder until you've checked it.</p>{ASSUMPTIONS.map(([k, l, , u, g]) => { const head = g !== last; last = g; return <React.Fragment key={k}>{head && <h3 className="group">{g}</h3>}<div className="arow" style={{ gridTemplateColumns: "minmax(0,1fr) 110px" }}><label htmlFor={`d-${k}`}>{l}{u !== "n" && ` (${u})`}</label><Num id={`d-${k}`} value={a[k]} onChange={(v) => v != null && saveWorkspace({ defaults: { ...a, [k]: v } })} /></div></React.Fragment>; })}</div>
    <div className="card"><h2>Your data</h2><p className="note">Download everything as a file, or restore the example if you are in the demo.</p><div className="row"><button id="export" className="btn alt" onClick={exportData}>Download my data</button>{adapter.reset && (confirm === "reset" ? <><button className="btn danger" onClick={() => { adapter.reset(); setConfirm(""); }}>Restore the example</button><button className="btn alt" onClick={() => setConfirm("")}>Cancel</button></> : <button className="btn alt" onClick={() => setConfirm("reset")}>Restore example</button>)}</div></div>
  </div>;
}
function AiSetup() {
  const { ws, saveWorkspace, adapter } = useStore(), [key, setKey] = useState(""), [state, setState] = useState(null), [msg, setMsg] = useState("");
  const on = ws.ai === "on";
  useEffect(() => { if (on && !adapter.demo) adapter.call("aiKeyStatus").then(setState).catch(() => setState(null)); }, [on, adapter]);
  const store = async () => { setMsg("Saving…"); try { await adapter.call("setAiKey", { key }); setKey(""); setState({ hasKey: true }); setMsg("Key saved. It can't be viewed again."); } catch (e) { setMsg(e.message); } };
  const clear = async () => { try { await adapter.call("clearAiKey"); setState({ hasKey: false }); setMsg("Key removed."); } catch (e) { setMsg(e.message); } };
  return <div className="card"><h2>AI features</h2><Seg label="AI" value={ws.ai || "off"} onChange={(v) => saveWorkspace({ ai: v })} options={[["off", "Off"], ["on", "On"]]} /><p className="note">Off by default. Every calculation and verdict works without AI. With it on, you can review legal packs and research leads, and you pay your AI provider directly.</p>
    {on && (adapter.demo ? <p className="note">The demo has no server, so key entry is switched off here.</p> : <>{state?.hasKey ? <div className="row"><span>A key is saved.</span><button className="btn alt" onClick={clear}>Remove key</button></div> : <div className="row" style={{ flexWrap: "nowrap" }}><input id="aiKey" type="password" autoComplete="off" aria-label="Anthropic API key" placeholder="Anthropic API key" value={key} onChange={(e) => setKey(e.target.value)} /><button className="btn alt" disabled={!key} onClick={store}>Save key</button></div>}<p className="note">Encrypted on the server and never sent back to this page. {msg}</p></>)}</div>;
}
