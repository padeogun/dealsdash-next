# DealsDash (new app)

Go/no-go reports for UK property deals, with one record from lead to exit. Separate from the current DealsDash app.

## Run it
- Demo with example data and no backend: `npm i --ignore-scripts && npm run demo`
- Tests: `npm test`. Security rules: `npm run test:rules` (needs Java for the Firestore emulator)

## Go live
1. Create a new Firebase project with Auth (Google), Firestore, Storage and Functions, in `europe-west2`.
2. Put the project ID in `.firebaserc`. Copy `.env.example` to `.env.local` and fill it in.
3. Set secrets: `firebase functions:secrets:set AI_KEY_ENCRYPTION_KEY` (from `openssl rand -base64 32`) and `EPC_API_KEY`.
4. `cd functions && npm i`, then back in the root `npm run build`, then `firebase deploy`.
5. Invite yourself with admin credentials: `npm run invite -- you@example.com "Your business"`.

## How it's organised
- `src/lib/engine/appraise.js` is the only place deal money is calculated. `src/lib/evaluate.js` gives the only verdict.
- `src/lib/programme` is the scheduler, reused from DealsDash with its golden tests.
- `src/lib/portfolio.js` derives Home, risk and Capital from deals and recorded money.
- All data sits under `workspaces/{id}`. Rules check membership and no email is hard-coded.
- Estately, the map Workspace and portal scraping are deliberately excluded.

## Before charging anyone
Legal review; UK GDPR position; Royal Mail and Ordnance Survey terms for Price Paid addresses; EPC register terms; EIG and Rightmove terms; Anthropic terms for customer keys; verdict wording. Stripe isn't built yet: `billing` is fixed at `pilot`, and only a server process should change it.

## Refresh area data
`python scripts/build_screener.py` writes `public/data/screener.json`. It has OGL attribution requirements, shown on the Areas page.
