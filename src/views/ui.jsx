// Small shared components. Plain React text rendering escapes all user content.
import React, { useEffect, useState } from "react";
export const num = (v) => { const s = String(v).replace(/[£,\s]/g, ""); if (s === "") return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : null; };
const fmt = (v) => (v == null ? "" : Number(v).toLocaleString("en-GB", { maximumFractionDigits: 2 }));
// Money or number box. Blank stays null, because blank means unknown and never zero.
export function Num({ id, label, value, onChange, placeholder, hint }) {
  const [t, setT] = useState(fmt(value)), [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setT(fmt(value)); }, [value, focus]);
  const input = <input id={id} inputMode="decimal" value={t} placeholder={placeholder} aria-label={label ? undefined : id} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={(e) => { setT(e.target.value); onChange(num(e.target.value)); }} />;
  return label ? <label>{label}{input}{hint && <span className="hint">{hint}</span>}</label> : input;
}
export const Text = ({ id, label, value, onChange, hint, placeholder, type = "text", max = 200 }) => <label>{label}<input id={id} type={type} value={value ?? ""} placeholder={placeholder} maxLength={max} onChange={(e) => onChange(e.target.value)} />{hint && <span className="hint">{hint}</span>}</label>;
export const Select = ({ id, label, value, onChange, options }) => <label>{label}<select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}</select></label>;
export const Seg = ({ label, value, onChange, options }) => <div className="seg" role="group" aria-label={label}>{options.map(([v, l]) => <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
export const Stat = ({ value, label }) => <div className="stat"><b>{value}</b><span>{label}</span></div>;
export const Section = ({ title, summary, open, children }) => <details className="section" open={open}><summary>{title}{summary && <span className="hint" style={{ fontFamily: "var(--font-sans)", marginLeft: 8 }}>{summary}</span>}</summary><div>{children}</div></details>;
export const Alerts = ({ items, go }) => (items.length === 0 ? <p className="note">Nothing needs attention.</p> : <ul className="plain">{items.map((a, i) => <li key={i} className="alert"><b className={a.level === "bad" ? "s-nogo" : "s-negotiate"}>{a.level === "bad" ? "Act now" : "Watch"}</b>{a.view && go ? <button className="link" style={{ fontWeight: 400 }} onClick={() => go(a.view)}>{a.text}</button> : <span>{a.text}</span>}</li>)}</ul>);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id${Date.now()}${Math.random().toString(16).slice(2)}`);
export const today = () => new Date().toISOString().slice(0, 10);
