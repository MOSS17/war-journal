# Design system: Classic UI

The War Journal looks like the classic game interface: wood, leather frames with gold rims, Classic gold text, red buttons, tooltip panels and parchment.

**Source of truth:** the "Classic UI (full set)" page of the [design canvas](https://claude.ai/artifact/BsNsbo1WQz6CYCtT7SNtVG). CSystem and CInputs define the tokens and components. CMain, CCharacter, CInstances, CGoals (War Plans), CJournal, CLibrary, CGlance, CFormsA and CFormsB show how the screens use them. The canvas's other pages are archived.

All tokens and components live in `src/styles/app.css`. Shared React pieces live in `src/components/ui.tsx` (`Frame`, `Rivets`, `SectionHead`, `Bar`, `Avatar`, `Money`, `EmptyState`) and `src/components/domain.tsx` (`PlanMini`, `JournalPage`).

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--page` / `--dusk` | #0D0907 / #2A120B | Page, with a radial dusk glow at the top |
| `--leather` → `--leather-2` | #2E1F15 → #17100B | Frame fill |
| `--edge`, `--rim`, `--rim-gap`, `--bronze` | #2A1A0D, #C9A24A, #1A110A, #6B4E24 | Frame: 3px edge, then inset rings 2px gold, 5px dark, 6px bronze. Radius 8 |
| `--plaque` | #6E1D13 → #3E0D08 | Title plaque, 2px gold border |
| `--gold` | #FFD100 | Titles, links, selected text |
| `--label` | #E9C76A | Labels |
| `--body` / `--muted` / `--faint` | #F1E6D0 / #C7B38C / #A8A8B4 | Body / secondary / tertiary text |
| `--shadow` | 0 1px 0 #000 | Text shadow on dark backgrounds |
| `--red` | #9C2015 → #5A0C07 | Buttons, selected tabs (`--red-sel`) |
| `--brown` | #3A2614 → #1F140B, border #6B4E24 | Tabs and toggles |
| `--tip` | rgba(8,8,22,.92), 2px #8F8F96 | Tooltip panel |
| `--parch` | #F3E4C0 → #E2C993 → #B8935A | Parchment. Ink #2B1A0C, headings #3A1A08, accents #7A1D10 |
| `--plank` | #5A3A1F / #4D3119 / #55361C | Wood: nav bar, notice board, journal board |
| `--xp` / `--skill` / `--progress` | #B072F0 → #6A1FB5 / #5A8AE0 → #1F4FA8 on #0A1430 / #E8C14A → #A07612 | Bars |
| `--well` | rgba(0,0,0,.6), 2px #5A4024 | Inputs. Focus #FFD100 + gold glow. Error #FF1A1A border, #FF4A3A text |
| `--done` / `--started` | #40C040 / #FFD100 | Run status, done objectives |

**Difficulty** (`DIFFICULTY_COLOR` in `src/lib/logic.ts`, same rule as before): trivial #9D9D9D, easy #40C040, even #FFFF00, hard #FF8040, deadly #FF1A1A.

**Item quality** (`QUALITY_COLOR` in `src/lib/gamedata.ts`): poor #9D9D9D, common #FFFFFF, uncommon #1EFF00, rare #0070DD, epic #A335EE, legendary #FF8000.

**Class colours** are unchanged.

## Type

Google Fonts, loaded in `index.html`:

- **Metamorphous** (`--f-title`): page titles, plaques, panel headings, character names.
- **Cinzel 700** (`--f-label`): nav, labels, buttons, tabs, tracker lines, status text.
- **Alegreya Sans** (`--f-ui`): interface text.
- **Alegreya**, italic (`--f-ink`): journal and parchment text.

## Components

- **Frame** (`.card`, `Frame`): leather with a gold rim, plus rivets (`Rivets`) and a title plaque (`.plaque`, `SectionHead`) centred on the top edge. Give a frame 40px top padding (`.card-pad`) so the plaque has room.
- **Tooltip panel** (`.tip`): data lists such as dungeons, roster cards, pinned links, the Quick add menu and toasts.
- **Tracker panel** (`.tracker`): dark glass with a crimson left rule. Holds tracked plans and Tonight's plan.
- **Well** (`.well`): a sunken black list or table inside a frame (Dungeon Finder, quest log, Notes & Links).
- **Parchment** (`.parch`, `.notice`, `.seal`, `.tack`): journal pages, instance and plan detail, notices. Child components (pills, checks, links, help text) switch to ink colours inside `.parch`.
- **Buttons**: `.btn` and `.btn2` are the red button. `.btn2.quiet` is a gold text button. `.btn2.danger` is brown with red text. Disabled buttons turn grey. `.xbtn` is the square red close button.
- **Tabs and toggles**: `.tbtn`, `.tog`, `.cat`, `.segs`, `.filterbar`. Brown, or red with gold text when selected.
- **Bars** (`Bar`): `xp` (purple, 20 ticks), `skill` (blue, value centred), `progress` (gold).
- **Pickers** (`.tiles` / `.tile` / `.ic`): square icon slots with a gold glow when selected. Used for race, class and plan type.
- **Inputs**: `.inp`, `.step` (red − and +), `.coin`, `.chips`, `.range` (the XP bar with a gold handle), `.cb`, `.sw`. The journal textarea (`.journal-text`) is parchment.
- **Dialog** (`Modal`): a frame with a title plaque and a red X. The Quick add menu is a tooltip panel.

## Signature patterns

- **Camp skyline hero** (`Skyline`): inline SVG with a palisade, huts, banners and campfire glow. 250px on the War Board, 150px elsewhere. Below it sits the **wood plank nav**: the brand and logo slot on the left, the active item red with a gold underline.
- **Portraits** (`Avatar`): a gold-ringed circle with a level badge on the lower left.
- **Quest tracker** (`PlanMini`): "[34] Scarlet Monastery" in the difficulty colour, objective lines below, done objectives green.
- **Empty states** (`EmptyState framed`): a frame with the title on a plaque and a red call to action.

## Rules

- No Blizzard logos or art. The tusk-shield mark (`Mark`, `public/mark.svg`) and the skyline are original. Keep the `data-logo-slot` in the nav.
- Focus outline: 2px #FFD100 with a 2px offset. Touch targets at least 44px, including tabs, steppers, slots and the 44px hit area around the 32px close button.
- Use difficulty and quality colours as text only on dark panels (frame, tooltip, well, tracker). They all reach at least 4.5:1 there; deadly red is the lowest at 4.9–5.2. On parchment, show difficulty in a dark ink chip and quality as a slot border.
- `prefers-reduced-motion: reduce` turns off transitions and the campfire flicker.
