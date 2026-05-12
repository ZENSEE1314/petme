# web-game — playable browser prototype

A complete browser-playable version of Smooth Giraffe. Runs entirely in the browser, saves to `localStorage`, no backend or installation required.

## Live URL

Once GitHub Pages is enabled, this game lives at:
**https://zensee1314.github.io/petme/**

To enable Pages (one-time, in your repo settings):
1. Go to https://github.com/ZENSEE1314/petme/settings/pages
2. Under "Build and deployment", set **Source** to **GitHub Actions**
3. Push any change to `web-game/` — the workflow at `.github/workflows/pages.yml` deploys automatically (~30 seconds)

## What's in here

```
web-game/
├── index.html          # 5 screens (Home, Dex, Shop, Eggs, Battle) + sign-up
├── style.css           # Pastel chibi aesthetic, mobile-first
├── data.js             # 30-pet dex, 4 egg types, items catalog
├── game.js             # State machine, persistence, gacha math, battle sim
├── ui.js               # DOM rendering for every screen
└── test.mjs            # Node test harness — 42 assertions, no browser needed
```

## Features that work right now

| System | Status |
|---|---|
| Sign-up with display name | ✅ |
| Pick a starter (3 choices) | ✅ |
| Real-time hunger/cleanliness/energy decay | ✅ |
| Feed / clean / play / sleep / pet | ✅ |
| Inventory + item use | ✅ |
| Shop: 4 egg tiers + 8 items | ✅ |
| Egg gacha with **predetermined-at-purchase** rolls | ✅ |
| Pity system: forced Rare at 50, Epic at 100, Legendary at 200 pulls | ✅ |
| Egg hatching with real-time timer + reveal modal | ✅ |
| 30-pet collection screen (dex) | ✅ |
| Async PvP against NPC opponents with deterministic seed | ✅ |
| Type effectiveness (Fire/Water/Grass triangle + Light/Dark) | ✅ |
| Trophy ladder + battle history | ✅ |
| Egg fragment drops + redemption | ✅ |
| Daily egg purchase cap (10/day) | ✅ |
| 4-currency economy (Coins, Gems, Stardust, Tickets) | ✅ |
| Save/load via localStorage | ✅ |
| Shiny variants (1/4096 hatch chance) | ✅ |

## What's NOT in this prototype (need real backend / Unity)

- Multiplayer trading (no other real players)
- 3D models / animation (using emoji as placeholder)
- Push notifications when pet needs care
- Cloud save / cross-device
- Monthly events

These are designed and coded in the Unity/Supabase architecture — see [`../design/PLAN.md`](../design/PLAN.md).

## Running locally

```powershell
# any static server works:
python -m http.server 5173 --directory web-game
# or
npx --yes serve web-game -l 5173
```

Then open http://localhost:5173/

## Running the test harness

```powershell
node web-game/test.mjs
```

Last result: **42 / 42 passed.**

## Architecture notes

The prototype intentionally mirrors the eventual server architecture:

- **Predetermined gacha rolls** — when you buy an egg, the species is rolled immediately and stored in `owned_eggs.predeterminedSpeciesId`. Opening just reveals it. This matches the Supabase edge function and prevents client-side reroll cheats once the real backend is online.
- **Append-only-ish ledger feel** — coins are spent via a single `spend()` function with a `reason` string, ready to swap for the real ledger insert.
- **Deterministic battles** — mulberry32 seeded RNG. The same seed produces identical fights everywhere. Replays will work the moment we move to the server.
- **Pity counters per tier** — same shape as the Postgres `pity_counters` table.

So when you finish Unity + Supabase setup, swapping out localStorage for API calls is largely a 1-for-1 substitution.
