// Adds someone to the invite list. Run with admin credentials: node scripts/invite.js person@example.com "Business name"
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const [email, businessName = "My business"] = process.argv.slice(2);
if (!email || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) { // Security fix 2026-11-06: a "/" would write to a nested path
  console.error('Usage: node scripts/invite.js person@example.com "Business name"'); process.exit(1); }
initializeApp();
await getFirestore().doc(`invites/${email.toLowerCase()}`).set({ businessName, createdAt: Date.now() });
console.log(`Invited ${email.toLowerCase()}`);
