// App entry. The demo build uses example data in the browser. The live build uses Firebase with sign-in.
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { StoreProvider, useStore } from "./data/store.jsx";
import { Home } from "./views/Home.jsx";
import { Deals } from "./views/Deals.jsx";
import { DealSheet } from "./views/DealSheet.jsx";
import { Capital } from "./views/Capital.jsx";
import { Areas } from "./views/Areas.jsx";
import { Contacts } from "./views/Contacts.jsx";
import { Setup } from "./views/Setup.jsx";
import { Guide } from "./views/Guide.jsx";
const DEMO = import.meta.env.VITE_DEMO === "1";
// Follow the device theme unless the host has already chosen one
if (!document.documentElement.getAttribute("data-theme")) document.documentElement.setAttribute("data-theme", "auto");

function Shell({ signOut }) {
  const { ws, error, deals } = useStore();
  const [view, setView] = useState(() => { const h = location.hash.slice(1); return h || "deals"; });
  // Plain #name routes so the browser's back button works
  const go = (v) => { location.hash = v.replace(":", "-"); setView(v); window.scrollTo(0, 0); };
  useEffect(() => { const f = () => { const h = location.hash.slice(1); if (h) setView(h.replace(/^deal-/, "deal:")); }; f(); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  if (!ws) return <div className="centre"><p className="note">{error ? "Your data couldn't be loaded. Refresh to try again." : "Loading…"}</p></div>;
  const m = ws.modules || {};
  const tabs = [["home", "Home"], ["deals", "Deals"], m.capital !== false && ["capital", "Capital"], m.areas !== false && ["areas", "Areas"], m.contacts !== false && ["contacts", "Contacts"], ["setup", "Setup"]].filter(Boolean);
  const base = view.startsWith("deal:") ? "deals" : view;
  return <><header className="top wrap"><div className="inner bar"><span className="brand">DealsDash</span><nav className="main" aria-label="Main">{tabs.map(([k, l]) => <button key={k} aria-current={base === k ? "page" : undefined} onClick={() => go(k)}>{l}</button>)}</nav><button className="who" onClick={() => go("guide")}>Guide</button>{DEMO ? <span className="who">Demo: example data</span> : <button className="who" onClick={signOut}>Sign out</button>}</div></header>
    <main className="wrap"><div className="inner">{error && <p className="s-nogo">A change couldn't be saved. Check your connection and try again.</p>}
      {view === "home" && <Home go={go} />}{view === "deals" && <Deals go={go} />}{view.startsWith("deal:") && <DealSheet key={view} id={view.slice(5)} go={go} />}{view === "capital" && <Capital />}{view === "areas" && <Areas />}{view === "contacts" && <Contacts />}{view === "setup" && <Setup go={go} />}{view === "guide" && <Guide />}</div></main></>;
}
function Demo() { const [ad, setAd] = useState(null); useEffect(() => { import("./data/demoAdapter.js").then((m) => setAd(m.demoAdapter())); }, []); return ad ? <StoreProvider adapter={ad} user={{ email: "demo" }}><Shell /></StoreProvider> : null; }
// Sign-in gate. Access is invite-only for now, and billing can attach to the workspace later.
function Live() {
  const [fb, setFb] = useState(null), [user, setUser] = useState(undefined), [wid, setWid] = useState(undefined), [err, setErr] = useState("");
  useEffect(() => { import("./data/firebase.js").then((m) => { setFb(m); m.onUser(setUser); }); }, []);
  useEffect(() => { if (!fb) return; if (!user) { setWid(undefined); return; } if (!user.emailVerified) { setWid(null); return; } fb.resolveWorkspace(user).then(setWid).catch(() => setErr("Your account couldn't be loaded. Try again.")); }, [fb, user]);
  const adapter = useMemo(() => (fb && wid ? fb.firebaseAdapter(wid) : null), [fb, wid]);
  if (user === undefined || !fb) return <div className="centre"><p className="note">Loading…</p></div>;
  if (!user) return <div className="centre"><h1>DealsDash</h1><p className="note">Go/no-go reports for UK property deals.</p><button className="btn" onClick={() => fb.signIn().catch(() => setErr("Sign-in didn't complete. Try again."))}>Sign in with Google</button><p className="note">{err}</p></div>;
  if (wid === undefined) return <div className="centre"><p className="note">{err || "Loading your workspace…"}</p></div>;
  if (wid === null) return <div className="centre"><h1>Invitation needed</h1><p className="note">DealsDash is invite-only for now, and {user.email} isn't on the list yet.</p><button className="btn alt" onClick={fb.signOutUser}>Sign out</button></div>;
  return <StoreProvider adapter={adapter} user={user}><Shell signOut={fb.signOutUser} /></StoreProvider>;
}
createRoot(document.getElementById("root")).render(DEMO ? <Demo /> : <Live />);
