// Proves one workspace can't reach another's data. Runs against the Firestore emulator.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
let env; const as = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: "demo-rules", firestore: { rules: readFileSync("firestore.rules", "utf8") } }); });
afterAll(() => env.cleanup());
beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await setDoc(doc(f, "workspaces/a"), { ownerUid: "alice", billing: "pilot", name: "A" }); await setDoc(doc(f, "workspaces/a/members/alice"), { role: "owner" }); await setDoc(doc(f, "workspaces/a/members/vera"), { role: "viewer" }); await setDoc(doc(f, "workspaces/a/deals/d1"), { address: "x" }); await setDoc(doc(f, "invites/inv@x.com"), { businessName: "B" }); await setDoc(doc(f, "aiKeys/a"), { body: "secret" }); }); });
const create = (f, uid) => { const b = writeBatch(f); b.set(doc(f, "workspaces/new"), { ownerUid: uid, billing: "pilot", name: "N" }); b.set(doc(f, "workspaces/new/members/" + uid), { role: "owner" }); b.set(doc(f, "users/" + uid), { workspaceId: "new" }); return b.commit(); };
describe("rules", () => {
  it("members read their deals", () => assertSucceeds(getDoc(doc(as("alice", "a@x.com"), "workspaces/a/deals/d1"))));
  it("non-members can't read deals", () => assertFails(getDoc(doc(as("bob", "b@x.com"), "workspaces/a/deals/d1"))));
  it("non-members can't write deals", () => assertFails(setDoc(doc(as("bob", "b@x.com"), "workspaces/a/deals/d2"), { address: "y" })));
  it("viewers can't write", () => assertFails(setDoc(doc(as("vera", "v@x.com"), "workspaces/a/deals/d2"), { address: "y" })));
  it("signed-out users can't read", () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "workspaces/a/deals/d1"))));
  it("unverified emails can't read", () => assertFails(getDoc(doc(env.authenticatedContext("alice", { email: "a@x.com", email_verified: false }).firestore(), "workspaces/a/deals/d1"))));
  it("nobody can read API keys", () => assertFails(getDoc(doc(as("alice", "a@x.com"), "aiKeys/a"))));
  it("owner can't change billing", () => assertFails(setDoc(doc(as("alice", "a@x.com"), "workspaces/a"), { ownerUid: "alice", billing: "paid", name: "A" })));
  it("owner can rename", () => assertSucceeds(setDoc(doc(as("alice", "a@x.com"), "workspaces/a"), { name: "B" }, { merge: true })));
  it("invited users can create a workspace", () => assertSucceeds(create(as("inv", "inv@x.com"), "inv")));
  it("uninvited users can't create one", () => assertFails(create(as("no", "no@x.com"), "no")));
  it("people can't add themselves to a workspace", () => assertFails(setDoc(doc(as("bob", "b@x.com"), "workspaces/a/members/bob"), { role: "owner" })));
  it("invites can't be self-issued", () => assertFails(setDoc(doc(as("bob", "b@x.com"), "invites/b@x.com"), {})));
  // Security review 2026-11-06
  it("a user can't point at a workspace they don't belong to", () => assertFails(setDoc(doc(as("bob", "b@x.com"), "users/bob"), { workspaceId: "a" })));
  it("a pointer at another workspace still gives no data", async () => { await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "users/bob"), { workspaceId: "a" })); await assertFails(getDoc(doc(as("bob", "b@x.com"), "workspaces/a/deals/d1"))); });
  it("a member can point at their own workspace", () => assertSucceeds(setDoc(doc(as("vera", "v@x.com"), "users/vera"), { workspaceId: "a" })));
  it("the pointer can't hold extra fields", () => assertFails(setDoc(doc(as("vera", "v@x.com"), "users/vera"), { workspaceId: "a", role: "owner" })));
  it("nobody can write another user's pointer", () => assertFails(setDoc(doc(as("bob", "b@x.com"), "users/vera"), { workspaceId: "a" })));
  it("an invite gives only one workspace", async () => { await create(as("inv", "inv@x.com"), "inv"); const f = as("inv", "inv@x.com"), b = writeBatch(f); b.set(doc(f, "workspaces/second"), { ownerUid: "inv", billing: "pilot" }); b.set(doc(f, "workspaces/second/members/inv"), { role: "owner" }); await assertFails(b.commit()); });
  it("a workspace can't be created without the pointer", () => { const f = as("inv", "inv@x.com"), b = writeBatch(f); b.set(doc(f, "workspaces/x"), { ownerUid: "inv", billing: "pilot" }); b.set(doc(f, "workspaces/x/members/inv"), { role: "owner" }); return assertFails(b.commit()); });
  it("viewers can't promote themselves", () => assertFails(setDoc(doc(as("vera", "v@x.com"), "workspaces/a/members/vera"), { role: "owner" })));
  it("viewers can't edit the workspace", () => assertFails(setDoc(doc(as("vera", "v@x.com"), "workspaces/a"), { ai: "on" }, { merge: true })));
  it("a member can't claim ownership", () => assertFails(setDoc(doc(as("vera", "v@x.com"), "workspaces/a"), { ownerUid: "vera" }, { merge: true })));
  it("clients can't write API keys", () => assertFails(setDoc(doc(as("alice", "a@x.com"), "aiKeys/a"), { body: "x" })));
});
