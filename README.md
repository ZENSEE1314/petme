# Smooth Giraffe

A 3D chibi virtual pet collection game — Digimon/Pokémon vibe, cross-platform, with care loop, farming, training, async PvP battles, gacha eggs, trading, monthly events, and a token-ready economy.

📋 **Master plan** (execution sequencing): [`design/PLAN.md`](design/PLAN.md)
📖 **GDD** (game design — single source of truth for *what* we build): [`design/GDD.md`](design/GDD.md)

**v1.0 launch scope**: 30 pets across 6 rarity tiers, 4 currencies, direct + async trading, monthly events, async PvP. Timeline: ~7.5 months solo.

---

## What's in this repo right now

### ✅ Done

- **Full design** in [`design/GDD.md`](design/GDD.md): 30-pet dex (Common→Legendary + event Mythic), 4-currency economy, egg gacha with pity (50/100/200), direct + async trading with 5% trade-tax sink, monthly events, complete DB schema
- **31-week execution plan** in [`design/PLAN.md`](design/PLAN.md)
- **Backend schema** (10 SQL migrations) in [`server/supabase/migrations/`](server/supabase/migrations):
  - 001 users / account flags / auto-create trigger
  - 002 monster species + owned monsters (rarity, evolution chains)
  - 003 items catalog + inventory
  - 004 unified 4-currency ledger + balances view + cap-enforcement trigger
  - 005 egg types + owned eggs + pity counters + daily purchase log
  - 006 farm plots + auto-seed-9-plots-per-user trigger
  - 007 battles (deterministic replay) + egg fragments
  - 008 trades (direct + async) + audit log + velocity counter
  - 009 events + quests + leaderboard
  - 010 seed data — 30 launch pets, 4 egg tiers, items catalog
- **Edge functions** in [`server/supabase/functions/`](server/supabase/functions):
  - `_shared/supabase.ts` — auth helpers + clients
  - `tick-needs/` — hourly cron, decays needs server-side (clock-cheat proof)
  - `buy-egg/` — server-authoritative gacha roll with pity
  - `hatch-egg/` — opens ready egg, creates monster
  - `farm-claim/` — server-authoritative harvest
  - `battle-simulate/` — async PvP with deterministic replay seed
  - `trade-execute/` — atomic trade settlement with 5% tax sink
- **Unity client scaffold** in [`client/Assets/Scripts/`](client/Assets/Scripts):
  - `Core/GameManager.cs` — singleton entry point
  - `Core/TimeService.cs` — server-time sync
  - `Net/ApiClient.cs` — HttpClient wrapper for Supabase REST + Functions
  - `Net/AuthManager.cs` — auth flows + PlayerPrefs persistence
  - `Pet/PetState.cs` — client mirror of the `monsters` table
- **Setup docs**: [`server/README.md`](server/README.md) · [`client/README.md`](client/README.md)
- **Nano Banana prompt queue** in [`design/concepts/GENERATE_THESE.md`](design/concepts/GENERATE_THESE.md) — ready to fire on quota reset

### ⏳ Next up

1. **Install Unity locally** (user action) — see `client/README.md`
2. **Create Supabase project + push migrations** (user action) — see `server/README.md`
3. **Build the Boot scene** in Unity — first verifiable end-to-end ping of client → server
4. **Generate concept art** — when Gemini quota resets
5. **Phase 1: Care loop** — feed/clean/play/sleep on a placeholder cube monster

## Project Layout

```
petme/
├── README.md                                      # ← you are here
├── .gitignore
├── client/                                        # Unity 2022.3 LTS
│   ├── README.md
│   └── Assets/
│       ├── Scripts/{Core,Pet,Farm,Battle,Training,Shop,Net,UI}/
│       └── {Art,Audio,Prefabs,Scenes}/
├── server/                                        # Supabase
│   ├── README.md
│   └── supabase/
│       ├── config.toml
│       ├── migrations/                            # 10 SQL files, run 001→010
│       └── functions/                             # Deno edge functions
├── shared/
│   └── battle-formulas/                           # math shared between client + server
└── design/
    ├── PLAN.md                                    # 31-week master plan
    ├── GDD.md                                     # canonical game design
    └── concepts/                                  # visual concept art
        ├── GENERATE_THESE.md                      # Nano Banana prompt queue
        └── {logo,eggs,monsters,environment}/
```

---

## Project Layout

```
smooth-giraffe/
├── client/                              # Unity project (Unity 2022.3 LTS)
│   └── Assets/
│       ├── Scripts/
│       │   ├── Core/                    # GameManager, SaveSystem, TimeService
│       │   ├── Pet/                     # PetState, CareSystem, EvolutionEngine
│       │   ├── Farm/                    # Plot, CropTimer, HarvestManager
│       │   ├── Battle/                  # Simulator, ReplayPlayer, TeamBuilder
│       │   ├── Training/                # Mini-games
│       │   ├── Shop/                    # ShopController, InventoryManager
│       │   ├── Net/                     # ApiClient, AuthManager, SyncEngine
│       │   └── UI/
│       ├── Art/                         # 3D models, textures
│       ├── Prefabs/
│       ├── Scenes/                      # Boot, Home, Farm, Battle, Shop
│       └── Audio/
│
├── server/                              # Supabase backend
│   └── supabase/
│       ├── migrations/                  # 001_users.sql ... 006_ledger.sql
│       └── functions/                   # Edge functions (Deno)
│           ├── battle-simulate/
│           ├── farm-claim/
│           ├── shop-buy/
│           ├── tick-needs/              # Cron: hourly needs decay
│           └── match-find/
│
├── shared/                              # Battle/economy math (TS + C# ports)
│   └── battle-formulas/
│
└── design/
    ├── GDD.md                           # Game design doc (TODO)
    ├── balance.xlsx                     # All numbers (TODO)
    └── concepts/                        # Nano Banana visual concepts
        ├── logo/
        ├── eggs/
        ├── monsters/
        ├── environment/
        └── GENERATE_THESE.md            # Pending image-gen prompts
```

---

## Session 1 Progress (2026-05-12)

- [x] Repo scaffold created
- [x] Image-generation prompts queued in `design/concepts/GENERATE_THESE.md`
- [ ] **Generate concept art** — blocked on Gemini API daily quota, resumes ~24h or on paid upgrade
- [ ] **Install Unity Hub + 2022.3 LTS** (user action) — WebGL + Android + iOS build modules
- [ ] **Create Supabase project** (user action) — free tier at supabase.com

## Session 2 (next)

- Write migrations 001–006 (empty tables + RLS policies)
- Set up Supabase auth
- Build Boot scene → logs in → shows placeholder cube
- Verify pipeline end-to-end

## Session 3

- Begin Phase 1: care loop (feed/clean/play/sleep) with placeholder cube as the monster

---

## Quick References

- Plan file: `C:\Users\Zen See\.claude\plans\i-want-to-create-smooth-giraffe.md`
- Unity download: https://unity.com/download
- Supabase: https://supabase.com
- Synty assets: https://syntystore.com
- Nano Banana ext: `gemini extensions list`
