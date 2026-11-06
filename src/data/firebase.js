// Live backend. Configuration comes from public VITE_FIREBASE_* values, never secrets.
// All data lives under workspaces/{id}, and security rules check membership on every read and write.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, collection, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { freshWorkspace } from "./seed.js";
const app = initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, appId: import.meta.env.VITE_FIREBASE_APP_ID });
export const auth = getAuth(app); const db = getFirestore(app), fns = getFunctions(app, "europe-west2"), storage = getStorage(app);
if (import.meta.env.VITE_USE_EMULATORS === "1") { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectFunctionsEmulator(fns, "127.0.0.1", 5001); }
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
export const onUser = (f) => onAuthStateChanged(auth, f);
// Finds the user's workspace. An invited user with none gets one. Without an invite, returns null.
export async function resolveWorkspace(user) {
  const u = await getDoc(doc(db, "users", user.uid));
  if (u.exists() && u.data().workspaceId) return u.data().workspaceId;
  const email = (user.email || "").toLowerCase();
  const inv = await getDoc(doc(db, "invites", email)).catch(() => null);
  if (!inv || !inv.exists()) return null;
  const id = doc(collection(db, "workspaces")).id, b = writeBatch(db);
  b.set(doc(db, "workspaces", id), { ...freshWorkspace(inv.data().businessName || "My business"), ownerUid: user.uid, plan: { taxPct: 19, target: 5000, maxDeals: 2 }, billing: "pilot" });
  b.set(doc(db, "workspaces", id, "members", user.uid), { role: "owner", email });
  b.set(doc(db, "users", user.uid), { workspaceId: id });
  await b.commit();
  return id;
}
export function firebaseAdapter(wid) {
  const col = (c) => collection(db, "workspaces", wid, c);
  return { demo: false, wid,
    onWorkspace: (f, e) => onSnapshot(doc(db, "workspaces", wid), (s) => f(s.data()), e),
    onCollection: (c, f, e) => onSnapshot(col(c), (s) => f(s.docs.map((d) => ({ ...d.data(), id: d.id }))), e),
    saveWorkspace: (p) => setDoc(doc(db, "workspaces", wid), p, { merge: true }),
    save: (c, d) => setDoc(doc(col(c), d.id), d),
    remove: (c, id) => deleteDoc(doc(col(c), id)),
    // Server functions always receive the workspace id and re-check membership themselves
    call: async (name, payload = {}) => (await httpsCallable(fns, name, { timeout: 300000 })({ ...payload, wid })).data,
    uploadPack: async (dealId, file) => { const path = `workspaces/${wid}/packs/${dealId}/${Date.now()}.pdf`; await uploadBytes(ref(storage, path), file, { contentType: "application/pdf" }); return path; } };
}
