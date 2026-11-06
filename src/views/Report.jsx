// The go/no-go report. The same evaluated data drives this view and the PDF.
import React, { useState } from "react";
import { useStore } from "../data/store.jsx";
import { Stat } from "./ui.jsx";
import { fmtDate, gbp } from "../lib/evaluate.js";
import { buildPdf, progRows } from "../lib/pdf.js";
export function Report({ d, R }) {
  const { ws, adapter } = useStore(), [msg, setMsg] = useState("");
  if (R.status === "incomplete") return <div className="report"><div className="verdict"><div className="word s-incomplete">Incomplete</div><p>A blank is treated as unknown, never as £0. To get a result, add:</p><ul className="plain">{R.missing.map((m) => <li key={m}>{m}</li>)}</ul></div></div>;
  const notes = (d.notes || "").split("\n").map((s) => s.trim()).filter(Boolean);
  // In the demo inside Claude, downloads go through the viewer. In the live app, the browser saves the file.
  const download = async () => { setMsg("Creating the PDF…"); try {
    const safe = (d.address || "deal").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "deal", doc = await buildPdf(d, R, ws), name = `${safe}-deal-sheet.pdf`;
    const dl = adapter.demo && window.claude?.use ? await window.claude.use("downloads") : null;
    if (dl) await dl.save({ filename: name, data: doc.output("blob") }); else doc.save(name);
    setMsg("PDF ready.");
  } catch (e) { setMsg(e?.code === "declined" ? "Download cancelled." : "The PDF couldn't be created. Try again."); } };
  return <div className="report" aria-live="polite">
    <div className="verdict"><div className={`word s-${R.status}`}>{R.word}</div><p>{R.line}</p><p className="note">Based on your own rules and assumptions. This is not advice.</p></div>
    <div className="stats">{R.stats.map((s) => <Stat key={s[1]} value={s[0]} label={s[1]} />)}</div>
    <div className="rsec"><h2>Tests</h2><ul className="plain">{R.tests.map((t) => <li key={t.t}><b className={t.ok ? "s-go" : "s-nogo"} style={{ display: "inline-block", minWidth: 40 }}>{t.ok ? "Pass" : "Fail"}</b>{t.t}</li>)}</ul></div>
    <div className="rsec"><h2>Programme</h2>{R.prog ? <><div className="scroll"><table><tbody>{progRows(R).map((x) => <tr key={x[0]} className={x[0] === "Back on market" ? "basis" : ""}><td>{x[0]}</td><td>{fmtDate(x[1])}</td></tr>)}</tbody></table></div><p className="note">Held for {R.months.toFixed(1)} months in the appraisal, from {R.monthsSource}. {R.prog.keyDates.buildDuration} working days on site.{R.isB ? " This is a sale plan, so BRRR months held stay separate until a refinance plan is built." : ""}</p></> : <p className="note">Held for {R.months.toFixed(1)} months, from {R.monthsSource}. Add a date to see the plan.</p>}</div>
    <div className="rsec"><h2>How the ceiling is built</h2><div className="scroll"><table><tbody>{R.stack.map((x) => <tr key={x[0]}><td>{x[0]}</td><td>{gbp(x[1])}</td></tr>)}<tr className="total"><td>Ceiling</td><td>{gbp(R.stackTotal)}</td></tr></tbody></table></div></div>
    <div className="rsec"><h2>Stress tests</h2><div className="scroll"><table><thead><tr>{R.stress.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{R.stress.rows.map((r) => <tr key={r.n} className={r.isBasis ? "basis" : ""}><td>{r.n}</td><td>{r.a}</td><td>{r.b}</td></tr>)}</tbody></table></div></div>
    {R.flags.length > 0 && <div className="rsec"><h2>Flags</h2><ul className="plain">{R.flags.map((f) => <li key={f}>{f}</li>)}</ul></div>}
    {notes.length > 0 && <div className="rsec"><h2>Open items</h2><ul className="plain">{notes.map((x) => <li key={x}>{x}</li>)}</ul></div>}
    <div className="rsec"><div className="row"><button id="pdf" type="button" className="btn" onClick={download}>Download one-page PDF</button><span className="note">{msg}</span></div></div>
  </div>;
}
