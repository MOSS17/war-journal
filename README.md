# Horde War Journal

A personal companion for WoW Forever: track every character's progress, set war plans for dungeons and raids, keep a journal of the journey, and save the guides you keep looking up.

- Design canvas: https://claude.ai/artifact/BsNsbo1WQz6CYCtT7SNtVG (Ember & Iron)
- System design and handoff notes: https://claude.ai/artifact/Wa8E24nQf9WXFE5JyivA5K

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # game logic and database tests
npm run build      # typecheck + production build into dist/
```

## How it works

- **Static app, no backend.** Vite, React 19, React Router 8 (declarative mode), TypeScript 7.
- **Storage:** IndexedDB through Dexie (`src/db/db.ts`). All data stays in the browser. Use **Backup & data** in the footer to export everything (screenshots included) as one JSON file, or to import it again.
- **Seed data:** `src/data/instances.json` (29 dungeons, 3 raids) and `src/data/events.json` (countdown dates). They're loaded on first run and never overwrite your edits. To ship new content, add rows and bump `SEED_VERSION` in `src/db/db.ts`.
- **Game logic** (`src/lib/logic.ts`, tested): difficulty colours (trivial → deadly), "fits my level", money, and plan progress.
- **Plan sync** (`src/db/actions.ts`): marking instance progress, levels, skills or gold completes matching war plans. Ticking a wing on a plan writes back to that instance's progress.

## Screens

| Route | Screen |
| --- | --- |
| `/` | War Board (home); first-run "Add your first character" when empty |
| `/characters`, `/characters/:id` | Roster and character page |
| `/instances?i=…` | Instance list, filters, detail panel |
| `/plans?p=…` | War Plans grouped by character |
| `/journal` | Journal pages, drafts, character and tag filters |
| `/library` | Links and notes, search, pins |
| `/glance` | 420px second-screen view (footer link pops it out) |

**Shortcuts:** N quick add · J journal entry · P war plan · U update progress · L save to Library · / search.

## Data model additions beyond the design doc

- Instance: `wings[]`, `notes`. InstanceProgress: `wingsCleared[]`.
- Character: `playedMinutes`, `copper` (gold stored in copper). Profession: `kind`.
- WarPlan: `objectives[]` (linked to wings or bosses, or free text), `tracked`, `notes`, `reward` + `rewardQuality`, recommended `level`. Difficulty is computed from level, not stored.
- JournalEntry: `imageIds[]`, `draft`, `level`. Screenshots live in an `images` table.
- LibraryItem: optional `instanceId` / `planId`. Event: `approxDate` + `dateLabel` for dates like "Spring 2027".
- TonightTask: the ad-hoc checklist on the War Board and Glance view.

Every game-describing record has `source` (manual / api / addon) and `updatedAt`, ready for a phase 2 importer.

## Deploy

`vercel.json` serves the app as a static SPA. Run `npx vercel` to deploy a preview, or `npx vercel --prod` for production. Each visitor's data stays in their own browser.

## Legal

Horde-inspired, original art only: the tusk-shield mark and skyline SVGs are original. The top bar keeps a logo slot (`data-logo-slot`) where an official asset may go unaltered on a non-commercial site, per Blizzard's guidelines. The footer carries the trademark credit.
