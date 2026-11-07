# Fightdesk — live UFC contest tracker

Your DraftKings UFC lineups vs the field: live rank, win/cash odds from 3,000 simulations of every fight left, the entries that threaten you most, who to root for, and "what if" scenarios. Built for a phone in one hand during the card.

React 19 + TypeScript + Vite + Tailwind + shadcn/ui. A static site: no server and no accounts. Your files are read and kept only in your browser (localStorage).

## Run it locally

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production build in dist/
```

You need Node 20+ and pnpm (`npm i -g pnpm`).

## Go live on Vercel (free Hobby plan)

1. **Put the code on GitHub.** Create a new private repo, then from this folder: `git init && git add . && git commit -m "Fightdesk" && git branch -M main && git remote add origin <your repo URL> && git push -u origin main`.
2. **Import it.** vercel.com → Add New → Project → pick the repo → Deploy. `vercel.json` already has the build settings. You'll get a `https://<name>.vercel.app` link. The app works at this point (imports stay on each device).
3. **Turn on sync.** In the project: Storage → Create → Blob (choose Private if asked) → connect it to the project. That adds `BLOB_READ_WRITE_TOKEN` for you.
4. **Add two settings.** Project → Settings → Environment Variables:
   - `SYNC_CODE` = a long passphrase you make up
   - `ODDS_API_KEY` = a free key from the-odds-api.com (500 credits a month; each refresh costs 1 and is shared by all your devices for 10 minutes)
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new settings load.
6. On each device open the site → Import → Settings → type the same sync code → Connect.

Vercel's Hobby plan is for personal, non-commercial use. A personal DFS tracker fits; selling access to it would not.

Without steps 3–5 the app still works as a single-device tracker; the Sync and Live odds rows say so.

**Netlify:** the front end deploys as-is (`netlify.toml`), but the two server routes in `api/` are written for Vercel, so sync and live odds need Vercel.

## Using it on fight night

1. **Import**: on draftkings.com (desktop site) export each contest's standings (it's a .zip; the CSV is inside) and your lineup export **DKEntries.csv**. Drop them on the **Import** tab. Contests match up by your lineups, and the name and entry fee fill in from DKEntries.
2. **Prize tables**: the export doesn't include payouts, so paste each contest's table on its card, one band per line (`1 1000`, `2-5 100`, `6-10 50`).
3. **Between fights**: re-export the standings and import again. Points update, and fights that already have points are set to live or final automatically. Confirm them on **Fights**, where you can also set the live clock and live win chance.
4. **Notifications**: turn them on under Import → Settings to hear when a lineup crosses the cash line. On iPhone, first add the site to your Home Screen (Share → Add to Home Screen).

Your DraftKings username (default `mattpecce`) is set under Import → Settings.

## What's where

| Tab | What it shows |
|---|---|
| Sweat | One-screen phone view: overall cash chance, live fight, who to root for, every entry's rank |
| Leaderboard | Biggest threats, then the full standings with projected points and win/cash/top-10 odds; tap an entry for its lineup |
| My lineups | Each lineup's odds, points needed, uniqueness and duplicates, best/worst case |
| What if | Pick winners and methods for fights left; every number re-filters instantly |
| Root for | Each fight's swing in expected payout and who to cheer |
| Fights | Set fights live/final, the live clock, live odds and points |
| Contests | All contests together: winning now vs expected, per lineup |
| Alerts | Cash-line crossings, big moves, fights that matter most |

## The model

The card, with odds looked up Nov 6 (prelims marked "estimate" are placeholders), is in `src/data/card-ufc-nov7.csv`. To use another card, import a CSV with the same columns on the Import tab. Each remaining fight is played 3,000 times: the winner is drawn from the vig-free odds, the fight ends by finish or decision at the fight's finish rate, and each fighter earns stat points per minute plus DraftKings' win bonus (R1 90, R2 70, R3 45, R4–5 40, decision 30). Everything runs in a Web Worker in the browser (`src/lib/sim.ts`).

Demo data (mock entries on the real card) loads on first open and is cleared by your first import.
