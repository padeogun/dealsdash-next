# Security log: 2026-11-06

Review of the new DealsDash app before any deployment. Nothing was deployed.

**How each result was checked**
- **Ran, Firestore rules:** the emulator suite, 24 of 24 passing (13 existing, 11 new).
- **Ran, unit tests:** `npx vitest run`, 56 of 56 passing.
- **Ran, functions:** a throwaway smoke test with Firebase, Storage and pdf-lib stubbed, plus `node --check`. It is not in the repo. It covers role gates, key storage, limits and sanitisers, but not real Firebase or Anthropic calls.
- **Read only:** `storage.rules` was edited but never run, because the permitted emulator command covers Firestore only. The CSP and Google sign-in were not tested in a browser.

`dist/` predates these fixes. Rebuild it before deploying.

## Findings

| # | Severity | Finding | Action | Location |
|---|---|---|---|---|
| 1 | High | Viewers could call `reviewLegalPack` and `researchLeads`, spending the owner's key. | Fixed. New `aiMember` gate allows owner or editor only. Smoke tested. | `functions/index.js` |
| 2 | High | Viewers could upload and delete legal packs in Storage. | Fixed. Create and delete now need owner or editor. **Not run.** | `storage.rules` |
| 3 | High | An AI review sets the pack to "Reviewed", which clears the "Legal pack hasn't been reviewed" flag. A partial or manipulated AI result can therefore remove a warning. The verdict word doesn't use this flag, but the report does. | **Open, product decision.** | `src/views/LegalPanel.jsx:14`, `src/lib/evaluate.js:61` |
| 4 | High | The server returns `unreadableSections`, including parts that gave no result, but the panel never shows them. Unread pages look like a complete review. Flags over 60 are also dropped without notice. | **Open, needs a UI change.** | `src/views/LegalPanel.jsx:27`, `functions/index.js` |
| 5 | Medium | One review counts as one call against the daily limit but makes one paid AI call per 90 pages. A very long PDF could cost far more than the limit implies. | Partly fixed. Packs are capped at 900 pages. Chunk-based counting is open. | `functions/index.js` |
| 6 | Medium | The "AI off" setting was only enforced in the UI, so a direct call could still spend the key. | Fixed. The server now checks `ai == "on"`. Smoke tested. | `functions/index.js` |
| 7 | Medium | `users/{uid}` accepted any content and any workspace id, and any signed-in Google user could write it. It gave no data access, but it allowed junk storage and false pointers. | Fixed. Only `workspaceId` is allowed, the user must be a member of that workspace, and delete is denied. Tested. | `firestore.rules`, `rules-tests/firestore.test.js` |
| 8 | Medium | Invites were never used up, so one invite could create unlimited workspaces. | Fixed. One workspace per user, which matches `resolveWorkspace`. Tested. | `firestore.rules` |
| 9 | Medium | No instance cap on functions. Default concurrency of 80 on a 1GiB PDF function risked running out of memory. | Fixed. `maxInstances: 10` and `concurrency: 4` on pack review. **Check that 10 suits paid load.** | `functions/index.js` |
| 10 | Medium | Prompts did not tell the model that packs and web pages are untrusted. | Fixed. Instructions added to both prompts. This reduces the risk but cannot remove it (see #3 and #4). | `functions/aiShared.js` |
| 11 | Medium | Model output was stored without length limits, and `triage` passed through any object. This could bloat or break deal documents. | Fixed. Strings capped and `triage` limited to known yes/no fields. Smoke tested. | `functions/aiShared.js`, `functions/index.js` |
| 12 | Medium | A real first name, "Paul", was in the programme owner labels, in the live bundle and shown to every user. | Fixed. Now "You". Display text only, and the scheduler tests pass. | `src/lib/programme/template.js` |
| 13 | Medium | The demo seed holds a real deal: 779 Ashton Road, its Rightmove link, the auctioneer and legal findings. The file calls it illustrative. It is not in `dist/`, but it is in `dist-demo/`, and the golden tests depend on it. | **Open.** Don't publish the demo as it stands. | `src/data/demoSeed.js` |
| 14 | Low | Re-saving a key reset that day's AI counter. | Fixed. The save now merges. Smoke tested. | `functions/index.js` |
| 15 | Low | Raw Storage upload errors could show bucket paths in the UI. | Fixed. A plain message replaces them. Parsed, not run. | `src/views/LegalPanel.jsx` |
| 16 | Low | The CSP had no `form-action` or `frame-ancestors`. | Fixed. Both added. Not browser tested. | `firebase.json` |
| 17 | Low | `.gitignore` missed admin SDK keys, `.secret.local`, `.runtimeconfig.json` and `*.pem`. | Fixed. | `.gitignore` |
| 18 | Low | The invite script accepted emails containing `/`, which would write to a nested path. | Fixed. Stricter email check. Not run. | `scripts/invite.js` |
| 19 | Low | The EPC and Planning lookups have no per-user limit, and EPC uses the service's shared key. | **Open.** The instance cap (#9) limits this only partly. | `functions/index.js` |
| 20 | Low | Comments mention VIXIV and the Ashton workbook. Minifying removes them from the live bundle, and a search of `dist/` found no Ashton text. | No change. Remove them before any source is shared. | `src/lib/engine/*`, `src/styles/*` |
| 21 | None | Pointing `users/{uid}.workspaceId` at another workspace gives no data access, because membership is checked on every read. | No issue. Tested. | `firestore.rules` |
| 22 | None | Member self-promotion: member update and delete are denied, and creating an owner record needs `ownerUid` to already be the caller. | No issue. Tests added. | `firestore.rules` |
| 23 | None | `ownerUid` and `billing` can't be changed by clients. Other workspaces' data was denied in every test. | No issue. Tested. | `firestore.rules` |
| 24 | None | `aiKeys` is closed to clients for read and write. | No issue. Tested. | `firestore.rules` |
| 25 | None | Key handling: AES-256-GCM with a random IV, owner-only set and clear, status returns only `hasKey`, not stored in the browser, and logging records only the HTTP status. | No issue. Smoke test confirmed no plaintext stored. | `functions/index.js`, `src/views/Setup.jsx` |
| 26 | None | SSRF: all outbound hosts are fixed, and the postcode and lat/lng are validated before use. | No issue. Smoke tested for EPC and Planning. | `functions/index.js`, `src/lib/lookups.js` |
| 27 | None | SPARQL injection: the outcode is checked against a strict pattern before it enters the query. | No issue. Read only. | `src/lib/lookups.js:6-8` |
| 28 | None | Pack path: must be inside the caller's workspace folder, with `..` rejected and the workspace id validated. | No issue. Smoke tested. | `functions/index.js` |
| 29 | None | Unsafe URLs: `sourceUrl` is never rendered as a link today, only as an input value. `safeUrl` blocks `javascript:`, including mixed case and leading spaces. Typed links aren't filtered, so any future link needs a scheme check. | No issue today. Smoke tested. | `src/views/DealSheet.jsx`, `functions/aiShared.js` |
| 30 | None | XSS: there is no `dangerouslySetInnerHTML` or `innerHTML` in `src`, so React escapes AI text. | No issue. Searched. | `src/` |
| 31 | None | CSP coverage: the live build uses external scripts, so `script-src 'self'` fits. Hosts cover Google sign-in, Functions, Firestore, Storage and the public lookups. `*.firebaseapp.com` is the only auth frame host, so a custom `authDomain` would need adding. | No issue on reading. **Browser test needed.** | `firebase.json`, `dist/index.html` |
| 32 | None | Secrets: a pattern search found no keys in the source. `.firebaserc` holds a placeholder, and the repo has no commits. The debug log held no secrets in a search. | No issue. Searched. | Repo root |
| 33 | None | Error messages: functions return fixed messages plus an HTTP status, never upstream response bodies. | No issue. Read only. | `functions/index.js` |

## Open items before charging users

1. **Stop AI review clearing the human review flag (#3).** Mark it "AI triaged" or similar, so only a person can set "Reviewed".
2. **Show unread sections and truncated flags (#4).** Without this, a partial review looks complete.
3. **Run `storage.rules` in the emulator and add tests (#2).**
4. **Test in a browser on the real host:** Google sign-in under the CSP, an upload, a function call and a PDF download.
5. **Turn on Firebase App Check** for functions, Firestore and Storage. None is configured.
6. **Set per-user limits on all functions (#19), count AI use by chunk (#5), and review the 900-page cap.** Check real pack sizes, and how many chunks finish inside the 300-second timeout.
7. **Set budgets and quotas:** Google Cloud budget alerts, a Storage lifecycle rule, and a total Storage limit per workspace. Members can currently upload unlimited 40 MB files.
8. **Decide legal pack retention and deletion under UK GDPR.** Packs are kept indefinitely, and there is no way to delete a workspace or account.
9. **Build member management.** There is no way to add, change or remove members except through admin tools, so a removed person can't be handled in the app.
10. **Decide who controls AI spend.** Editors can switch AI on and spend the owner's key. Consider making the switch owner-only.
11. **Plan encryption key rotation.** `AI_KEY_ENCRYPTION_KEY` has no version field, and ciphertext isn't bound to its workspace.
12. **Remove the real deal from the demo seed (#13)** before publishing any demo, replacing the golden test fixture carefully.
13. **Tell users to set a spend limit with their AI provider.** The daily call limit doesn't cap cost.
14. **Hide AI controls from viewers.** The server now refuses them, but they still see the buttons.
15. **Keep `billing` server-only** when Stripe is added, and verify webhooks.
16. **Complete the legal review listed in the README,** including Anthropic terms for customer keys.

## Behaviour changes to confirm

These small changes went in as low risk. Reverse any you disagree with.
- Packs over 900 pages are refused.
- Each user can create only one workspace.
- Viewers can no longer run AI features or upload or delete packs.
- Programme owner labels now say "You".

## 2026-11-06 Roma Finance lender terms
| # | Severity | Finding | Action | Location |
|---|---|---|---|---|
| 1 | None | Lender terms are static data plus one select with fixed options. Numbers pass through existing validation, and flags render as React text | No new input or network route | `src/lib/engine/lenders.js`, `DealSheet.jsx` |

## 2026-11-19 Deploy workflow: Firebase web settings and start-up error
Change: the deploy workflow's build step reads the five `VITE_FIREBASE_*` values from repository variables through `env` and stops before building if any is empty. `main.jsx` shows a plain message if the Firebase chunk fails to load. Finding 1 was fixed before commit. Nothing else changed in this review.

| # | Severity | Finding | Action | Location |
|---|---|---|---|---|
| 1 | Bug, not security | The new `if (bootErr) return` sat above a `useEffect` and a `useMemo`. When start-up failed, React 18 would throw "Rendered fewer hooks than expected" and the page would go blank, so the message would never show. | **Fixed** the same day: the return now sits after every hook, next to the "Loading…" return. | `src/main.jsx:43` |
| 2 | None | The five values are public web config, also served at `/__/firebase/init.json` and in the bundle. None is a secret, so variables are fine. Access still depends on rules and a restricted API key. | No issue. | `.github/workflows/deploy.yml` |
| 3 | None | Script injection: `vars.*` reach the script only through `env`, the loop uses fixed names with `${!v}`, and the trigger is push to `main`, so no event text enters the shell. | No issue. Read only. | `.github/workflows/deploy.yml` |
| 4 | None | The start-up message is fixed text. It shows no error, path or config. | No issue. | `src/main.jsx:39` |

**Recommendations (pre-existing, not changed)**
1. Replace `FIREBASE_TOKEN` (deprecated) with a service account, ideally Workload Identity Federation via `google-github-actions/auth`. Until then, pass the token through `env` rather than inline `${{ secrets.* }}`.
2. Add `permissions: contents: read` so the job token isn't write by default.
3. Pin `actions/checkout` and `actions/setup-node` to commit SHAs.
4. Add `concurrency: { group: deploy-hosting, cancel-in-progress: false }` so two pushes can't deploy out of order.
5. Move Node 23 (end of life) to an LTS line, 22 or 24.
6. Restrict the Firebase API key in Google Cloud (HTTP referrers, allowed APIs) and turn on App Check (open item 5, 2026-11-06).
7. Consider a GitHub `production` environment with required reviewers for the deploy job.

## 2026-11-19 Deploy workflow hardening and service account migration
Change: the deploy workflow pins `actions/checkout` and `actions/setup-node` (v4.4.0) and `google-github-actions/auth` (v2.1.13) to commit SHAs, moves to Node 22, sets `permissions: contents: read`, adds a `deploy-hosting` concurrency group, runs `npm test` before the build, and adds `workflow_dispatch`. A new step picks the login: the `FIREBASE_SERVICE_ACCOUNT` secret if set, otherwise `FIREBASE_TOKEN` with a deprecation warning, otherwise it fails. The token now reaches firebase-tools only through `env`. This closes recommendations 1 (partly: the token goes through `env` and the service account path is ready, but the key and the token still need swapping, and Workload Identity Federation is not used), 2, 3, 4 and 5 from the entry above. Findings 1, 3 and 9 were fixed before commit.

| # | Severity | Finding | Action | Location |
|---|---|---|---|---|
| 1 | Low | `workflow_dispatch` lets anyone with write access run the deploy from any branch or tag, so unreviewed or old code can go live. Write access can already push to `main` or add a workflow, so this adds little today. | **Fixed** before commit: the job now has `if: github.ref == 'refs/heads/main'`. | `.github/workflows/deploy.yml:7` |
| 2 | Low | A service account key is a long-lived secret. If it leaks it works until it is deleted. | Open. Move to Workload Identity Federation: `permissions: id-token: write`, `workload_identity_provider` and `service_account` in place of `credentials_json`, and `roles/iam.workloadIdentityUser` limited to this repo and `refs/heads/main`. Delete the key and `FIREBASE_TOKEN` afterwards. | `.github/workflows/deploy.yml:67-71` |
| 3 | Low | `npx firebase-tools@15.34.0` downloads the CLI at deploy time outside the lockfile, and runs it holding the deploy login. The lockfile has 15.35.0 as a dev dependency. | **Fixed** before commit: the deploy step runs `npx firebase`, the locked 15.35.0 copy installed by `npm ci`. | `.github/workflows/deploy.yml:77`, `package.json` |
| 4 | None | Secrets: `if:` tests only the `mode` output, which is `sa` or `token`. The presence checks reach the shell as `true`/`false` through `env`. No secret is in run text or an output. There is no `pull_request` trigger and no event text in any script. | No issue. Read only. | `.github/workflows/deploy.yml:54-77` |
| 5 | None | Deploy login: in token mode the expression gives the token. In service account mode it gives an empty string. firebase-tools 15.34.0 and 15.35.0 skip an empty `FIREBASE_TOKEN` and fall through to Application Default Credentials, which the auth action points at `GOOGLE_APPLICATION_CREDENTIALS`. | No issue. Read in `lib/requireAuth.js`. | `.github/workflows/deploy.yml:76` |
| 6 | None | `contents: read` is enough: checkout needs it, and `credentials_json` needs no GitHub token. | No issue. | `.github/workflows/deploy.yml:10-11` |
| 7 | None | Pinned SHAs match their tags on GitHub (`git ls-remote`): checkout `11d5960a` = v4.4.0, setup-node `49933ea5` = v4.4.0, auth `c200f369` = v2.1.13. | No issue. Checked. | `.github/workflows/deploy.yml:23,25,69` |
| 8 | None | `npm test` runs `vitest run` on `src/**/*.test.js` only, so the emulator rules tests are left out. 59 tests pass on Node 22. The login is set after `npm ci`, test and build, so install scripts never see it. | No issue. Run locally. | `vite.config.js`, `.github/workflows/deploy.yml:30-34` |
| 9 | None | The concurrency comment says "in push order". GitHub keeps one pending run and cancels older pending ones, so the newest push deploys and older ones can't overwrite it, but not every push deploys. | **Fixed** before commit: comment reworded. | `.github/workflows/deploy.yml:13-16` |

**Service account roles for `firebase deploy --only hosting`:** Firebase Hosting Admin (`roles/firebasehosting.admin`) and API Keys Viewer (`roles/serviceusage.apiKeysViewer`). Add Cloud Run Viewer (`roles/run.viewer`) only if Hosting rewrites to Functions or Cloud Run are added. Today the only rewrite is to `/index.html`. Source: the `FirebaseExtended/action-hosting-deploy` service account guide and Google's Cloud Build "Deploy to Firebase" page. **Not tested with a real deploy.**

**Recommendations still open**
6. Restrict the Firebase API key in Google Cloud (HTTP referrers, allowed APIs) and turn on App Check (open item 5, 2026-11-06).
7. Consider a GitHub `production` environment with required reviewers for the deploy job. Its branch rule would also close finding 1.
