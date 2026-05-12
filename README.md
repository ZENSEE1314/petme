# Smooth Giraffe

A 3D chibi virtual pet collection game — Digimon/Pokémon vibe, cross-platform, with care loop, farming, training, async PvP battles, gacha eggs, trading, monthly events, and a token-ready economy.

📋 **Master plan** (execution sequencing): [`design/PLAN.md`](design/PLAN.md)
📖 **GDD** (game design — single source of truth for *what* we build): [`design/GDD.md`](design/GDD.md)

**v1.0 launch scope**: 30 pets across 6 rarity tiers, 4 currencies, direct + async trading, monthly events, async PvP. Timeline: ~7.5 months solo.

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
