// One-page A4 report drawn from the same evaluated data as the screen. Loaded on demand to keep the app small.
import { fmtDate, gbp } from "./evaluate.js";
import { ASSUMPTIONS } from "./engine/assumptions.js";
export const progRows = (R) => { const k = R.prog.keyDates; return [["Purchase completes", k.completion], ["Works start", k.worksStart], ["Works finish", k.pc], ["Back on market", k.listed], ["Sale agreed", k.saleAgreed], ["Sale completes", k.saleCompleted]]; };
export async function buildPdf(d, R, ws) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" }), W = 210, M = 14, NAVY = [27, 42, 74], MUTED = [85, 98, 122], ICE = [231, 236, 243], COL = { go: [46, 125, 79], negotiate: [138, 101, 8], nogo: [193, 83, 60] }[R.status];
  const clean = (s) => String(s).replace(/²/g, "2").replace(/[^\x20-\xFF]/g, "-");   // stays inside the PDF font's character set
  const text = (s, x, y, o = {}) => { doc.setFont(o.serif ? "times" : "helvetica", o.bold ? "bold" : "normal"); doc.setFontSize(o.size || 9); doc.setTextColor(...(o.color || NAVY)); doc.text(clean(s), x, y, o.right ? { align: "right" } : {}); };
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 24, "F");
  text(ws.name || "", M, 10, { color: [255, 255, 255], bold: true, size: 10 }); text("Deal Sheet", W - M, 10, { color: [255, 255, 255], size: 10, right: true });
  text(d.address + (d.postcode ? ", " + d.postcode : ""), M, 18, { color: [255, 255, 255], serif: true, bold: true, size: 14 });
  let y = 36; text(R.word, M, y, { serif: true, bold: true, size: 28, color: COL });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...NAVY); doc.text(doc.splitTextToSize(clean(R.line), 118), W - M - 118, y - 7);
  y = 47; text(`${R.isB ? "BRRR" : "Flip"} · ${d.route === "auction" ? "Auction" : "Agent"} · ${gbp(R.P)} tested · refurb ${R.ref.basis} · held ${R.months.toFixed(1)} months (${R.monthsSource})`, M, y, { color: MUTED });
  y = 51; const sw = (W - 2 * M) / 4; doc.setFillColor(...ICE); doc.rect(M, y, W - 2 * M, 17, "F");
  R.stats.forEach((s, i) => { text(s[0], M + 3 + i * sw, y + 7, { serif: true, bold: true, size: 13 }); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(clean(s[1]), sw - 5), M + 3 + i * sw, y + 11); });
  y = 76; const cw = (W - 2 * M - 8) / 2, x2 = M + cw + 8;
  const head = (s, x, yy, w = cw) => { text(s, x, yy, { bold: true, size: 10, serif: true }); doc.setDrawColor(...NAVY); doc.line(x, yy + 1.5, x + w, yy + 1.5); };
  head("How the ceiling is built", M, y); head("Stress tests", x2, y);
  let yl = y + 6; R.stack.forEach((s) => { text(s[0], M, yl, { size: 8.5 }); text(gbp(s[1]), M + cw, yl, { size: 8.5, right: true }); yl += 5; });
  doc.line(M, yl - 3.5, M + cw, yl - 3.5); text("Ceiling", M, yl, { bold: true }); text(gbp(R.stackTotal), M + cw, yl, { bold: true, right: true });
  let yr = y + 6; text(R.stress.head[0], x2, yr, { size: 7.5, color: MUTED }); text(R.stress.head[1], x2 + cw - 20, yr, { size: 7.5, color: MUTED, right: true }); text(R.stress.head[2], x2 + cw, yr, { size: 7.5, color: MUTED, right: true }); yr += 5;
  R.stress.rows.forEach((r) => { if (r.isBasis) { doc.setFillColor(...ICE); doc.rect(x2, yr - 3.5, cw, 5, "F"); } text(r.n, x2, yr, { size: 8.5, bold: r.isBasis }); text(r.a, x2 + cw - 20, yr, { size: 8.5, bold: r.isBasis, right: true }); text(r.b, x2 + cw, yr, { size: 8.5, bold: r.isBasis, right: true }); yr += 5; });
  yr += 3; head("Tests", x2, yr); yr += 6;
  R.tests.forEach((t) => { text(t.ok ? "Pass" : "Fail", x2, yr, { size: 8.5, bold: true, color: t.ok ? [46, 125, 79] : [193, 83, 60] }); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); const l = doc.splitTextToSize(clean(t.t), cw - 10); doc.text(l, x2 + 9, yr); yr += 4 * l.length + 1; });
  y = Math.max(yl, yr) + 7;
  if (R.prog) { head("Programme", M, y, W - 2 * M); y += 6; const pw = (W - 2 * M) / 6; progRows(R).forEach((x, i) => { text(fmtDate(x[1]), M + i * pw, y, { size: 8.5, bold: x[0] === "Back on market" }); text(x[0], M + i * pw, y + 3.8, { size: 6.8, color: MUTED }); }); y += 11; }
  head("Assumptions", M, y, W - 2 * M); y += 5.5;
  // Only the assumptions the verdict used, marked as confirmed or assumed
  const keys = ASSUMPTIONS.filter(([k, , , , g]) => !k.startsWith("rate") && !k.startsWith("prog") && (g !== "BRRR" || R.isB) && (g !== "Auction fees" || d.route === "auction") && !(k === "mFlip" || k === "mBrrr") && (g !== "Lender terms" || d.a.lender) && (g !== "Sale" || !R.isB) && (g !== "Refurb" || R.ref.basis !== "total"));
  const colW = (W - 2 * M) / 3, per = Math.ceil(keys.length / 3);
  keys.forEach((a, i) => { const v = a[3] === "£" ? gbp(d.a[a[0]]) : a[3] === "%" ? d.a[a[0]] + "%" : String(d.a[a[0]]), on = d.conf?.[a[0]], x = M + Math.floor(i / per) * colW, yy = y + (i % per) * 3.9; text(a[1], x, yy, { size: 6.8, color: MUTED }); text(v + (on ? "" : " *"), x + colW - 4, yy, { size: 6.8, right: true, bold: !!on }); });
  y += per * 3.9 + 0.5; text("* Assumed. Bold figures have been confirmed.", M, y, { size: 6.8, color: MUTED }); y += 6;
  const notes = (d.notes || "").split("\n").map((s) => s.trim()).filter(Boolean).concat(R.flags);
  if (notes.length) { head("Open items and flags", M, y, W - 2 * M); y += 6; notes.slice(0, 10).forEach((n) => { if (y < 280) { text("- " + n.slice(0, 125), M, y, { size: 8.5 }); y += 4.4; } }); }
  doc.setDrawColor(...ICE); doc.line(M, 285, W - M, 285);
  text("Illustrative, based on the assumptions shown. Not financial, legal or tax advice, and not an offer of investment. Verify figures before relying on them.", M, 289, { size: 6.8, color: MUTED });
  return doc;
}
