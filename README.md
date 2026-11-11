# Horde War Journal

A personal companion for WoW Forever: track every character's progress, set war plans for dungeons and raids, keep a journal of the journey, and save the guides you keep looking up.

- Design canvas: https://claude.ai/artifact/BsNsbo1WQz6CYCtT7SNtVG ("Classic UI (full set)" page). Tokens, components and rules: [DESIGN.md](DESIGN.md)
- System design and handoff notes: https://claude.ai/artifact/Wa8E24nQf9WXFE5JyivA5K

## Run it

```sh
npm install
vercel env pull     # writes the Supabase keys to .env.local (git-ignored)
npx supabase start  # local Supabase stack (needs Docker)
npm run db:env      # point the dev server at the local stack
npm run dev         # http://localhost:5173
npm test            # game logic tests
npm run test:db     # data layer, account and access tests against the local stack (emails land in Mailpit, http://127.0.0.1:54324)
npm run build       # typecheck + production build into dist/
```

Without `npm run db:env`, the dev server uses the hosted project from `.env.local`.

## How it works

- **Static app on Supabase.** Vite, React 19, React Router 8 (declarative mode), TypeScript 7, TanStack Query.
- **Look:** Classic UI, the classic game interface style (leather frames, gold plaques, red buttons, tooltip panels, parchment). All styling is in `src/styles/app.css`; see [DESIGN.md](DESIGN.md).
- **Storage:** Supabase (see Database below). Every visitor gets an anonymous account the first time they save. Screenshots are resized to 1920 px (WebP) and kept in the private `screenshots` bucket. Use **Backup & data** in the footer to export everything as one JSON file, or to restore one.
- **Seed data:** `src/data/instances.json` (29 dungeons, 3 raids) and `src/data/events.json` (countdown dates) are loaded into shared catalog tables. A player's edits to a seeded row are stored as their own override; the catalog keeps the reference data (territory, Horde access, quests) current.
- **Game logic** (`src/lib/logic.ts`, tested): difficulty colours (trivial → deadly), "fits my level", money, and plan progress.
- **Plan sync** (`src/db/actions.ts`): marking instance progress, levels, skills or gold completes matching war plans. Ticking a wing on a plan writes back to that instance's progress.

## Screens

| Route | Screen |
| --- | --- |
| `/` | War Board (home); first-run "Add your first character" when empty |
| `/characters`, `/characters/:id` | Roster and character page |
| `/instances?i=…` | Instance list split into Horde & contested / Alliance territory, filters (`ally=0` hides the Alliance side), detail panel with quests |
| `/plans?p=…` | War Plans grouped by character |
| `/journal` | Journal pages, drafts, character and tag filters |
| `/library` | Links and notes, search, pins |
| `/glance` | 420px second-screen view (footer link pops it out) |

**Shortcuts:** N quick add · J journal entry · P war plan · U update progress · L save to Library · / search.

## Data model additions beyond the design doc

- Instance: `wings[]`, `notes`, `territory` (horde / contested / alliance, from a Horde player's view), `hordeAccess` (how to get there), `quests[]` (giver, location, level, prerequisite, how to get it, faction, key/attunement). InstanceProgress: `wingsCleared[]`, `questsDone[]`.
- Character: `playedMinutes`, `copper` (gold stored in copper). Profession: `kind`.
- WarPlan: `objectives[]` (linked to wings or bosses, or free text), `tracked`, `notes`, `reward` + `rewardQuality`, recommended `level`. Difficulty is computed from level, not stored.
- JournalEntry: `imageIds[]`, `draft`, `level`. Screenshots live in an `images` table.
- LibraryItem: optional `instanceId` / `planId`. Event: `approxDate` + `dateLabel` for dates like "Spring 2027".
- TonightTask: the ad-hoc checklist on the War Board and Glance view.

Every game-describing record has `source` (manual / api / addon) and `updatedAt`, ready for a phase 2 importer.

## Database (Supabase)

Plan and decisions: [accounts and cloud storage plan](https://claude.ai/artifact/P7zWqxwTAoUJDCZMJB3d88).

- **Schema** (`supabase/migrations/`): `records` holds every player object as JSON, keyed by `(user_id, kind, id)`, with row-level security so each user only reaches their own rows. `apply_changes(changes)` writes a batch in one transaction; `replace_records(rows)` swaps all of a player's records at once (restore, start over). `instance_catalog` and `event_catalog` hold the seeded content, readable by anyone. `profiles` has one row per user. The private `screenshots` bucket keeps files under `<user_id>/`.
- **App data layer** (`src/db/`): `store.ts` reads each kind through TanStack Query, merges the catalogs (`src/lib/catalog.ts`), saves through `apply_changes` with an instant update that rolls back on failure, and refreshes from Realtime when another tab (like the Glance view) or device changes something. `actions.ts` runs the pure mutations in `src/lib/mutations.ts` one at a time. `supabase.ts` holds the client and the session.
- **Accounts** (`src/db/account.ts`, `src/forms/AccountForms.tsx`): email only, by magic link or the 6-digit code in the same email (templates in `supabase/templates/`). Saving an anonymous account attaches the email to the same user, so nothing moves. Signing in from a browser with an anonymous journal offers to copy it in (the account's rows win). Saved accounts can sign out or delete themselves (`delete_my_account()`). Anonymous players see a save reminder after their first character, first plan or entry, and every fifth visit, until they dismiss it three times.
- **Screenshots** (`src/db/images.ts`): each is an `images` record plus a file at `screenshots/<user_id>/<id>`, shown through signed URLs that last an hour. Deleting the record deletes the file; orphans from abandoned drafts are cleaned up when the journal form closes.
- **Old browser journals:** on load, `localImport.ts` copies a browser-only journal up once if the account is empty, then its screenshots are uploaded. The browser keeps its copy.
- **New game content:** edit `src/data/*.json`, then `npm run db:catalog` writes a migration that upserts it.
- **Hosted project:** created through the Vercel Marketplace. Apply new migrations with `npx supabase db push --remote "$POSTGRES_URL_NON_POOLING"` before deploying code that needs them. Only the `NEXT_PUBLIC_` URL and anon key reach the browser.

## Deploy

`vercel.json` serves the app as a static SPA. Run `npx vercel` to deploy a preview, or `npx vercel --prod` for production. Merging to `main` deploys to production. Player data lives in Supabase.

## Legal

Horde-inspired, original art only: the tusk-shield mark and skyline SVGs are original. The plank nav keeps a logo slot (`data-logo-slot`) where an official asset may go unaltered on a non-commercial site, per Blizzard's guidelines. The footer carries the trademark credit.
