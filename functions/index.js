// Server functions. Every call checks sign-in and workspace membership before doing anything.
// Each workspace pays for its own AI with its own key. The key is encrypted here and never returned.
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const admin = require("firebase-admin");
const { PDFDocument } = require("pdf-lib");
const S = require("./aiShared.js");
admin.initializeApp();
setGlobalOptions({ maxInstances: 10 }); // Security fix 2026-11-06: caps how far a call flood can scale the hosting bill
const db = admin.firestore();
const EPC_API_KEY = defineSecret("EPC_API_KEY");
const AI_KEY_SECRET = defineSecret("AI_KEY_ENCRYPTION_KEY"); // 32 random bytes as base64
const REGION = "europe-west2", MODEL = "claude-sonnet-5-5", ANTHROPIC = "https://api.anthropic.com/v1/messages";
const DAILY_AI_CALLS = 30; // protects users from runaway spend on their own key
const MAX_PACK_PAGES = 900; // Security fix 2026-11-06: one review counts once but costs one AI call per chunk. 10 chunks already exceeds the 300s timeout in practice.

// Confirms the caller is a verified member of the workspace and returns their role
async function member(request) {
  const auth = request.auth, wid = request.data && request.data.wid;
  if (!auth || !auth.token.email_verified) throw new HttpsError("unauthenticated", "Sign in first.");
  if (typeof wid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(wid)) throw new HttpsError("invalid-argument", "Workspace not recognised.");
  const snap = await db.doc(`workspaces/${wid}/members/${auth.uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "You aren't a member of this workspace.");
  return { wid, uid: auth.uid, role: snap.data().role };
}
// AES-256-GCM. The ciphertext sits in a collection that clients can never read.
function encrypt(text, keyB64) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv), body = Buffer.concat([c.update(text, "utf8"), c.final()]); return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), body: body.toString("base64") }; }
function decrypt(o, keyB64) { const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), Buffer.from(o.iv, "base64")); d.setAuthTag(Buffer.from(o.tag, "base64")); return Buffer.concat([d.update(Buffer.from(o.body, "base64")), d.final()]).toString("utf8"); }
const keyDoc = (wid) => db.doc(`aiKeys/${wid}`);
// Security fix 2026-11-06: spending the workspace's key needs edit rights and AI switched on, checked here as well as in the UI.
async function aiMember(request) {
  const m = await member(request);
  if (!["owner", "editor"].includes(m.role)) throw new HttpsError("permission-denied", "Viewers can't run AI features.");
  if ((await db.doc(`workspaces/${m.wid}`).get()).get("ai") !== "on") throw new HttpsError("failed-precondition", "AI features are switched off in Setup.");
  return m;
}

exports.setAiKey = onCall({ region: REGION, secrets: [AI_KEY_SECRET] }, async (request) => {
  const m = await member(request);
  if (m.role !== "owner") throw new HttpsError("permission-denied", "Only the workspace owner can change the key.");
  const key = request.data.key;
  if (typeof key !== "string" || key.length < 20 || key.length > 300 || !/^[\x21-\x7e]+$/.test(key)) throw new HttpsError("invalid-argument", "That doesn't look like an API key.");
  await keyDoc(m.wid).set({ ...encrypt(key, AI_KEY_SECRET.value()), updatedAt: Date.now() }, { merge: true }); // Security fix 2026-11-06: merge, so re-saving a key doesn't reset today's limit
  return { hasKey: true };
});
exports.clearAiKey = onCall({ region: REGION }, async (request) => { const m = await member(request); if (m.role !== "owner") throw new HttpsError("permission-denied", "Only the workspace owner can change the key."); await keyDoc(m.wid).delete(); return { hasKey: false }; });
exports.aiKeyStatus = onCall({ region: REGION }, async (request) => { const m = await member(request); return { hasKey: (await keyDoc(m.wid).get()).exists }; });

// Loads the key and applies the daily limit in one transaction
async function aiKeyFor(wid) {
  const ref = keyDoc(wid), today = new Date().toISOString().slice(0, 10);
  const enc = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) throw new HttpsError("failed-precondition", "Add your API key in Setup first.");
    const v = s.data(), used = v.day === today ? v.used || 0 : 0;
    if (used >= DAILY_AI_CALLS) throw new HttpsError("resource-exhausted", "You've reached today's AI limit. Try again tomorrow.");
    t.update(ref, { day: today, used: used + 1 });
    return v;
  });
  return decrypt(enc, AI_KEY_SECRET.value());
}
async function anthropic(key, body) {
  let r; try { r = await fetch(ANTHROPIC, { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) }); }
  catch (e) { throw new HttpsError("unavailable", "Couldn't reach the AI service. Try again shortly."); }
  if (r.status === 401) throw new HttpsError("failed-precondition", "Your API key was rejected. Check it in Setup.");
  if (!r.ok) { logger.error("AI service error", r.status); throw new HttpsError("internal", `The AI service returned an error (${r.status}).`); }
  return r.json();
}
exports.reviewLegalPack = onCall({ region: REGION, secrets: [AI_KEY_SECRET], timeoutSeconds: 300, memory: "1GiB", concurrency: 4 }, async (request) => { // Security fix 2026-11-06: the default concurrency of 80 would let parallel 40 MB PDFs exhaust 1GiB
  const m = await aiMember(request), path = request.data.path;
  // The file must sit in the caller's own workspace folder
  if (typeof path !== "string" || !path.startsWith(`workspaces/${m.wid}/packs/`) || path.includes("..")) throw new HttpsError("permission-denied", "That file isn't in your workspace.");
  const key = await aiKeyFor(m.wid);
  let buf; try { [buf] = await admin.storage().bucket().file(path).download(); } catch (e) { throw new HttpsError("not-found", "Couldn't read that file."); }
  if (buf.length > S.MAX_INPUT_MB * 1048576) throw new HttpsError("invalid-argument", `File is over ${S.MAX_INPUT_MB} MB.`);
  let pdf; try { pdf = await PDFDocument.load(buf, { ignoreEncryption: true }); } catch (e) { throw new HttpsError("invalid-argument", "This couldn't be read as a PDF."); }
  const pages = pdf.getPageCount(), chunks = [];
  if (pages > MAX_PACK_PAGES) throw new HttpsError("invalid-argument", `This pack has over ${MAX_PACK_PAGES} pages. Split it and review the parts.`);
  for (let i = 0; i < pages; i += S.MAX_PAGES_PER_CHUNK) { const d = await PDFDocument.create(), idx = Array.from({ length: Math.min(S.MAX_PAGES_PER_CHUNK, pages - i) }, (_, k) => i + k); (await d.copyPages(pdf, idx)).forEach((p) => d.addPage(p)); chunks.push(Buffer.from(await d.save())); }
  const flags = [], unread = [], tenure = [], fees = [], found = new Set(); let completion = null;
  for (let n = 0; n < chunks.length; n++) {
    const data = await anthropic(key, { model: MODEL, max_tokens: 3000, tools: [S.FLAG_PACK_TOOL], messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: chunks[n].toString("base64") } }, { type: "text", text: S.buildLegalPackPrompt(n + 1, chunks.length) }] }] });
    const use = (data.content || []).find((b) => b.type === "tool_use" && b.name === "report_legal_pack_flags");
    if (!use || !use.input) { unread.push(`Part ${n + 1} of ${chunks.length} returned no result`); continue; } // reported, never silently dropped
    const inp = use.input, cf = Array.isArray(inp.flags) ? inp.flags.map(S.sanitizeFlag) : [];
    if (inp.tenure) tenure.push(String(inp.tenure).slice(0, 1000)); flags.push(...cf);
    if (Array.isArray(inp.unreadableSections)) unread.push(...inp.unreadableSections.map((x) => String(x).slice(0, 300)));
    if (inp.additionalFees) fees.push(S.sanitizeFeesFallback(inp.additionalFees, cf));
    if (Array.isArray(inp.itemsFound)) inp.itemsFound.forEach((x) => S.CHECKLIST_ITEMS.includes(x) && found.add(x));
    if (inp.completion && !completion && (Number(inp.completion.completionDays) > 0 || inp.completion.deadlineDate)) completion = S.sanitizeCompletion(inp.completion);
  }
  return { pages, tenureSummary: [...new Set(tenure)].join(" "), flags: flags.slice(0, 60), unreadableSections: unread.slice(0, 20), additionalFees: S.mergeFees(fees), completion: completion || null, missingItems: S.CHECKLIST_ITEMS.filter((x) => !found.has(x)), reviewedAt: Date.now(), model: MODEL };
});
exports.researchLeads = onCall({ region: REGION, secrets: [AI_KEY_SECRET], timeoutSeconds: 180, memory: "512MiB" }, async (request) => {
  const m = await aiMember(request), criteria = request.data.criteria;
  if (typeof criteria !== "string" || !criteria.trim() || criteria.length > 1000) throw new HttpsError("invalid-argument", "Describe what you're looking for in up to 1,000 characters.");
  const key = await aiKeyFor(m.wid);
  const data = await anthropic(key, { model: MODEL, max_tokens: 4000, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: S.MAX_SEARCHES_PER_RUN }, S.REPORT_LEADS_TOOL], messages: [{ role: "user", content: S.buildResearchPrompt(criteria.trim()) }] });
  const use = (data.content || []).find((b) => b.type === "tool_use" && b.name === "report_leads");
  return { leads: use && Array.isArray(use.input?.leads) ? S.cleanStaleAuctionDates(S.sanitizeLeads(use.input.leads)) : [] };
});
// EPC register lookup. The service key stays on the server. Check the register's terms before opening this to paying users.
exports.epcLookup = onCall({ region: REGION, secrets: [EPC_API_KEY], timeoutSeconds: 30 }, async (request) => {
  await member(request); const pc = String(request.data.postcode || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{5,7}$/.test(pc)) throw new HttpsError("invalid-argument", "Enter a full postcode first.");
  const r = await fetch(`https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search?postcode=${pc}`, { headers: { Authorization: `Bearer ${EPC_API_KEY.value()}`, Accept: "application/json" } }).catch(() => { throw new HttpsError("unavailable", "Couldn't reach the EPC register."); });
  if (!r.ok && r.status !== 404) throw new HttpsError("internal", `The EPC register returned an error (${r.status}).`);
  const j = await r.json().catch(() => null), rows = j && Array.isArray(j.data) ? j.data : [], latest = new Map();
  for (const c of rows) { const k = c.uprn || c.addressLine1, e = latest.get(k); if (!e || String(c.registrationDate) > String(e.registrationDate)) latest.set(k, c); }
  return { properties: [...latest.values()].slice(0, 20).map((c) => ({ address: [c.addressLine1, c.addressLine2].filter(Boolean).join(", "), band: c.currentEnergyEfficiencyBand || "Unknown", date: c.registrationDate || "" })), checkedAt: Date.now() };
});
// Planning Data (England, beta). An empty answer doesn't prove there's no constraint, and the app says so.
const PLANNING_SETS = { "article-4-direction-area": "Article 4 direction", "conservation-area": "Conservation area", "listed-building": "Listed building" };
exports.planningLookup = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  await member(request); const lat = Number(request.data.lat), lng = Number(request.data.lng);
  if (!(lat >= 49 && lat <= 61 && lng >= -9 && lng <= 3)) throw new HttpsError("invalid-argument", "Location not recognised.");
  const qs = Object.keys(PLANNING_SETS).map((d) => `dataset=${d}`).join("&");
  const r = await fetch(`https://www.planning.data.gov.uk/entity.json?${qs}&latitude=${lat}&longitude=${lng}&limit=20`).catch(() => { throw new HttpsError("unavailable", "Couldn't reach Planning Data."); });
  if (!r.ok) throw new HttpsError("internal", `Planning Data returned an error (${r.status}).`);
  const j = await r.json(); return { found: [...new Set((j.entities || []).map((e) => `${PLANNING_SETS[e.dataset] || e.dataset}: ${String(e.name || "").slice(0, 80)}`))], checkedAt: Date.now() };
});
