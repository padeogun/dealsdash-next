// Demo backend: example data held in the browser. Used only for the demo build and tests.
import { demoData, demoWorkspace } from "./demoSeed.js";
const KEY = "dealsdash.demo.v1";
function load() { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.ws && Array.isArray(o.deals)) return o; } catch (e) { /* storage may be blocked */ } return { ws: demoWorkspace(), ...demoData() }; }
export function demoAdapter() {
  let s = load(); const subs = { ws: new Set() };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* the page still works in memory */ } };
  const emit = (c) => (subs[c] || []).forEach((f) => f(c === "ws" ? s.ws : [...s[c]]));
  const on = (c, f) => { (subs[c] ||= new Set()).add(f); f(c === "ws" ? s.ws : [...s[c]]); return () => subs[c].delete(f); };
  return { demo: true, onWorkspace: (f) => on("ws", f), onCollection: (c, f) => on(c, f),
    saveWorkspace: async (p) => { s.ws = { ...s.ws, ...p }; persist(); emit("ws"); },
    save: async (c, d) => { s[c] = s[c].some((x) => x.id === d.id) ? s[c].map((x) => (x.id === d.id ? d : x)) : [...s[c], d]; persist(); emit(c); },
    remove: async (c, id) => { s[c] = s[c].filter((x) => x.id !== id); persist(); emit(c); },
    call: async () => { throw new Error("This needs the live app. The demo has no server."); },
    reset: async () => { s = { ws: demoWorkspace(), ...demoData() }; persist(); emit("ws"); ["deals", "movements", "contacts", "facilities"].forEach(emit); } };
}
