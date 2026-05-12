# Plan — "Smooth Giraffe" (working title): 3D Virtual Pet Game

> ⚠️ **SCOPE EXPANDED 2026-05-12.** Originally 7 systems and 18 monster forms; user added 30-pet launch dex (→100 by year 1), 4-currency economy, rarity tiers, egg gacha with pity, trading (direct + async), and monthly events. Timeline grew from ~24 to ~31 weeks. **Full design lives in `C:\Users\Zen See\smooth-giraffe\design\GDD.md`** — read it alongside this plan.

## Context

You want a 3D Digimon-style virtual pet game with **ten** interlocking systems:

1. **Care loop** — feed, clean, play, sleep (the Tamagotchi/Digimon core)
2. **Farming** — plant seeds, real-time growth, harvest crops
3. **Training** — mini-games that grow monster stats
4. **Battles** — online PvP against other players' monsters
5. **Pet collection (dex)** — 30 pets at launch, scaling to ~100 by end of year 1, with 6 rarity tiers
6. **Egg gacha** — buy/event eggs that roll random pets weighted by rarity, with pity system
7. **Trading** — direct invite + async public offer board, both at launch
8. **Events** — monthly themed events with Mythic egg drops and FOMO rewards
9. **Inventory & items** — food, medicine, toys, accessories, seeds, eggs
10. **4-currency economy** — Coins, Gems, Stardust, Trade Tickets; Stardust is the crypto-bridge candidate for v2

### Your constraints (from clarifying Qs)

| Decision | Choice | Implication |
|---|---|---|
| Platform | **Cross-platform from day one** | Unity engine (one codebase → WebGL + iOS + Android + Desktop) |
| Tokens | **Hybrid (in-game now, crypto later)** | Build coin ledger in DB now; design schema so it can wrap to on-chain tokens in v2 |
| Team | **Solo + Claude** | Lean stack, buy art instead of making it, server-authoritative everything (no anti-cheat work) |
| Art style | **Cute chibi (Digimon/Pokémon vibe)** | Synty Studios / commissioned chibi models, low-poly, cheap to produce |
| Battles | **Turn-based, async** | No WebSocket headache; battle ghost replays of other players (like Clash Royale) |
| MVP scope | **"Everything at once" + collection/gacha/trade/events** | All 10 systems in v1. Phased build but single launch. Realistic timeline: **~7.5 months solo** (31 weeks). |
| Launch dex | **30 pets, expanding to ~100 by year 1** | Live-ops content drops monthly. Full rarity tier coverage at launch (Common → Legendary), Mythic via events only. |
| Trading | **Both direct + async offer board at launch** | Server-mediated escrow, 1 Trade Ticket per trade, 24h cooldown on fresh pets, 7d on Legendary, starter pet untradable. |
| Currencies | **4: Coins / Gems / Stardust / Trade Tickets** | Each has one job. Stardust is the future on-chain candidate (v2 only). |

### Why this matters

The hard part isn't any single system — it's making them **feed each other**: farm produces food → food cares for monster → monster trains stats → stats win battles → battles earn coins → coins buy seeds. That loop is the whole game. Plan is designed around protecting that loop, not around any single screen.

---

## Tech Stack

### Client (the game)

- **Unity 2022 LTS** — best solo-dev cross-platform engine, massive asset store, free until you cross $200K revenue
- **C#** — Unity's language
- **URP (Universal Render Pipeline)** — runs well on mobile + WebGL, looks great with chibi/stylized art
- **Cinemachine** — camera system (free Unity package)
- **DOTween Pro** — UI/object animation (Asset Store, ~$15)
- **TextMeshPro** — text rendering (free, built into Unity)

### Backend

- **Supabase** (recommended) — Postgres + Auth + Edge Functions + Storage + Realtime, generous free tier
  - Why Supabase over Firebase: Postgres makes the crypto migration in v2 vastly easier (joins, ledger queries, deterministic replays). Firebase's NoSQL would force a rewrite.
- **Deno Edge Functions** for battle simulation, farm claim, shop purchase (server-authoritative)
- **Postgres** schema migrations checked into git

### Art & Audio

- **Synty Studios POLYGON Adventure / Fantasy** packs ($30–80 each, environments + props)
- **Mixamo** (free, Adobe) for humanoid animations
- **Custom chibi monsters**: commission on Fiverr/ArtStation ($50–200 per monster), or use **Meshy.ai** / **Tripo** AI tools as a first pass
- **Kenney.nl** — free UI, icons, sound effects
- **Pixabay / FreeSound** — free music
- Budget guideline: $500–1500 in art/sound for full v1.0

### Cross-cutting infra

- **OneSignal** or **Firebase Cloud Messaging** — push notifications ("your pet is hungry")
- **PostHog** (free tier) — analytics
- **Sentry** (free tier) — crash reporting
- **GitHub** — version control + Actions for CI builds

---

## Game Design

### Monster lifecycle (Digimon-faithful)

```
Egg → Baby → Child → Teen → Adult → Mega
 (0)   (1)    (2)    (3)    (4)     (5)
```

- Evolution path depends on **care quality** (avg mood last 7 days), **training stats**, and **items used**
- Same egg can become any of ~3 forms at each stage → branching tree
- Bad care = devolution or death (optional toggle for casual players)

### Starter pool for v1.0

- **3 starter eggs** (Fire / Water / Grass — classic elemental trio)
- Each egg has **3 stage-1 forms × 3 stage-2 forms × 2 final forms = 18 forms per starter**
- Total: **54 monster forms** in v1.0
  - Reality check: at $100/model commissioned, that's $5,400. **Compromise: 3 starters × 6 forms each = 18 forms for v1.0 (~$1,800)** — expand monthly post-launch.

### Stats system

| Stat | Trained by | Effect |
|---|---|---|
| HP | Eating + sleeping | Damage you can take |
| ATK | "Punching bag" mini-game | Damage you deal |
| DEF | "Wall push" mini-game | Damage you reduce |
| SPD | "Running" mini-game | Turn order |
| INT | "Puzzle" mini-game | Special move power |

### Elements (rock-paper-scissors + 1)

- **Fire > Grass > Water > Fire** (classic triangle)
- **Light ⇄ Dark** (mutual super-effective, rare encounters)

### Care needs (decay in real time)

| Need | Decay rate | Restored by |
|---|---|---|
| Hunger | -10/hour | Food items, harvested crops |
| Cleanliness | -8/hour, +20 after meals | Soap, bath items |
| Energy | -12/hour | Sleep (must place to bed) |
| Mood | average of the 3 above + petting + play | All of the above |

Mood < 30 for 24h → evolution path locks to "rebellious" branch. Mood > 80 sustained → unlocks "loyal" branch.

### Farming

- **3×3 garden plot** to start, expandable to 6×6 via in-game purchase
- Real-world-clock timers, server-authoritative (clock cheats blocked)
- Seeds for v1.0:

| Crop | Grow time | Sell value | Special |
|---|---|---|---|
| Carrot | 15 min | 5 coins | Restores +10 hunger |
| Wheat | 1 hour | 25 coins | Crafts into bread |
| Strawberry | 4 hours | 80 coins | Mood +5 |
| Apple Tree | 12 hours | 200 coins | Permanent plot, harvest weekly |
| Golden Mushroom | 24 hours | 600 coins | Battle XP boost item |

Water plant for +20% yield (one tap per crop per growth cycle).

### Battle system (async)

- Build a team of **1 to 3 monsters**
- Tap "Find Match" → server picks opponent within ±100 trophies
- Battle is **fully simulated server-side** (deterministic, replay seed stored)
- Client downloads result + seed, **re-simulates locally with animations** → looks live but is async
- Turn-based: pick move (Attack / Special / Defend / Item) each turn
- Win = +20 trophies + coins + chance at item drop. Lose = -10 trophies.
- Leagues: Bronze (0–500) → Silver → Gold → Diamond → Champion (5000+)
- Weekly league reset with rewards

### Shop & economy

- **NPC shop** (sells seeds, food, medicine, accessories — uses coins)
- **Trader NPC** (rare items rotated daily, uses "Gems" earned from battles/quests)
- **Player market** [v1.1 — post-launch] — list items for other players to buy

### Token architecture (crypto-ready)

```sql
-- v1 schema, crypto-ready
coin_ledger        -- in-game coins, append-only
gems_ledger        -- premium currency, append-only
monsters           -- has nullable token_id, metadata_uri columns
items              -- has nullable token_id, metadata_uri columns
wallet_links       -- empty in v1, populated in v2 (user_id ↔ wallet_address)
```

In v2 (post-launch, after legal review):

- Plug WalletConnect into Unity
- Mirror coin balance to Solana SPL or Polygon ERC-20 token
- Mint monsters as NFTs on demand (user-initiated, gas fee paid by user)
- **Important: do not promise tokens in v1.0 marketing.** Ship a fun game first; tokens are a v2 reward for loyal players.

---

## Project Structure

```
giraffe/
├── client/                              # Unity project
│   └── Assets/
│       ├── Scripts/
│       │   ├── Core/
│       │   │   ├── GameManager.cs
│       │   │   ├── SaveSystem.cs
│       │   │   └── TimeService.cs       # Wall-clock + server time sync
│       │   ├── Pet/
│       │   │   ├── PetState.cs          # Hunger, mood, energy, clean
│       │   │   ├── CareSystem.cs        # Feed, clean, play, sleep actions
│       │   │   ├── EvolutionEngine.cs   # Branching tree logic
│       │   │   └── PetAnimator.cs
│       │   ├── Farm/
│       │   │   ├── FarmPlot.cs
│       │   │   ├── CropTimer.cs
│       │   │   └── HarvestManager.cs
│       │   ├── Battle/
│       │   │   ├── BattleSimulator.cs   # Mirrors server logic exactly
│       │   │   ├── ReplayPlayer.cs
│       │   │   └── TeamBuilder.cs
│       │   ├── Training/
│       │   │   ├── MinigameBase.cs
│       │   │   └── minigames/PunchBag.cs, WallPush.cs, Runner.cs, Puzzle.cs
│       │   ├── Shop/
│       │   │   ├── ShopController.cs
│       │   │   └── InventoryManager.cs
│       │   ├── Net/
│       │   │   ├── ApiClient.cs         # REST wrapper to Supabase
│       │   │   ├── AuthManager.cs
│       │   │   └── SyncEngine.cs        # Offline → online reconciliation
│       │   └── UI/
│       │       └── (one folder per screen)
│       ├── Art/        (Synty + commissioned monsters)
│       ├── Prefabs/
│       ├── Scenes/
│       │   ├── Boot.unity
│       │   ├── Home.unity              # Pet's room + main hub
│       │   ├── Farm.unity
│       │   ├── Battle.unity
│       │   └── Shop.unity
│       └── Audio/
├── server/                              # Supabase project
│   └── supabase/
│       ├── migrations/                  # Versioned SQL
│       │   ├── 001_users.sql
│       │   ├── 002_monsters.sql
│       │   ├── 003_inventory.sql
│       │   ├── 004_farm.sql
│       │   ├── 005_battles.sql
│       │   └── 006_ledger.sql
│       ├── functions/                   # Edge functions
│       │   ├── battle-simulate/
│       │   ├── farm-claim/
│       │   ├── shop-buy/
│       │   ├── tick-needs/              # Cron: decays needs hourly
│       │   └── match-find/
│       └── seed.sql                     # Items catalog, monster species
├── shared/                              # Shared logic — IMPORTANT
│   └── battle-formulas/                 # Same code runs on client + server
│       └── (TypeScript → ported to C#)
├── design/
│   ├── GDD.md                           # Game design doc
│   ├── balance.xlsx                     # Stat curves, economy tuning
│   └── monster-tree.svg                 # Evolution branches
└── README.md
```

**Critical design rule:** battle math and economy math live in `shared/` and are reimplemented identically on client (C#) and server (TypeScript/Deno). Server is authoritative; client mirrors for animation/preview.

---

## Database Schema (Postgres / Supabase)

```sql
-- Core identity
users (id, email, display_name, wallet_address NULL, created_at)

-- Monsters
monster_species (id, name, element, base_stats_json, sprite_path, evolves_from NULL)
monsters (
  id, owner_id, species_id, nickname,
  stage, xp, hp, atk, def, spd, intl,
  hunger, cleanliness, energy, mood,
  last_tick_at,
  token_id NULL, metadata_uri NULL,    -- crypto bridge fields
  created_at
)

-- Inventory & items
items_catalog (id, name, type, sub_type, base_price, effect_json, sprite_path)
inventory (user_id, item_id, qty, PRIMARY KEY(user_id, item_id))

-- Farm
farm_plots (id, user_id, slot_index, seed_id NULL, planted_at, ready_at, watered_at NULL)

-- Battle
battles (id, attacker_id, defender_id, attacker_team_json, defender_team_json,
         result, replay_seed, trophy_delta, created_at)
trophies (user_id PK, count, league)

-- Economy (append-only for audit)
coin_ledger (id, user_id, delta, reason, ref_id, created_at)
gems_ledger (id, user_id, delta, reason, ref_id, created_at)

-- Crypto bridge (empty in v1, populated v2)
wallet_links (user_id PK, wallet_address, chain, linked_at)
nft_mints (monster_id PK, token_id, tx_hash, minted_at)
```

Row-Level Security (RLS) on every table — users only see/edit their own rows. Edge functions use service role for cross-user operations (battles).

---

## Build Phases (everything ships in v1.0, sequenced) — UPDATED

| Phase | Weeks | Deliverable | Goal |
|---|---|---|---|
| **0. Foundations** | 1–2 | Unity project, Supabase project, auth flow, 1 placeholder cube monster in a 3D room | Pipeline works end-to-end |
| **1. Care loop** | 3–5 | 1 real monster, feed/clean/play/sleep, needs decay in real time, push notification | Validate "Tamagotchi feeling" |
| **2. Dex + Evolution + Rarity** | 6–10 | 30-pet dex, 12 evolution lines, 6 rarity tiers, egg hatching | Collection identity established |
| **3. Farming** | 11–13 | 3×3 garden, 5 crops, server-authoritative timers | Daily-return hook |
| **4. Shop + Inventory + Egg Gacha** | 14–16 | NPC shop, 4-currency ledgers, 4 egg tiers, pity counters, published drop rates | Collection growth loop closed |
| **5. Training** | 17–18 | 4 mini-games, stat gain feeds into evolution | Reason to keep playing daily |
| **6. Battle system** | 19–23 | Async PvP, team builder, replays, trophies, leagues, fragment drops | Social/competitive layer |
| **7. Trading + Events** *(NEW)* | 24–27 | Direct trade, async offer board, escrow, audit log, 1 launch event | Community + retention layer |
| **8. Polish** | 28–30 | Tutorial, daily quests, sound, juice, notifications tuned | Ship-quality experience |
| **9. Soft launch** | 31 | WebGL on itch.io + Android open beta | Real players, real feedback |
| **10. Live-ops (post-launch)** | ongoing | Monthly: 8–10 new pets + 1 themed event | Year-1 content roadmap to ~100 dex |
| **11. v2 (later)** | far post | WalletConnect, Stardust on-chain mirror, NFT minting | Crypto bridge, only if community wants it |

**Reality check:** 31 weeks = ~7.5 months solo, assuming ~4 focused hours/day and using bought/commissioned art. If part-time, double it. Phase 1 must be playable by you internally by week 5 — if it isn't fun yet, **stop and rework the care loop** before continuing. The care loop is the soul; collection/gacha/trade are amplifiers, not replacements for fun.

**Art reality:** 30 pets × ~$80 commissioned avg = ~$2,400 art budget for launch. Or use Meshy.ai for first-pass models (~$30/mo subscription) and commission only the 6 Rare+ hero pets ($600). Plan for this cost in months 3–6, before Phase 2 work blocks on missing art.

---

## Key Reusable Patterns to Look For

Since this is a greenfield project, there's no existing codebase to reuse from. But adopt these proven patterns:

- **Hay Day / FarmVille** timer model — server stores `planted_at` + `ready_at`, client polls
- **Clash Royale** async PvP — replay seed + deterministic sim
- **Pokémon** stat formula — `damage = (((2*level/5+2)*power*atk/def)/50+2) * STAB * type_effectiveness * random(0.85..1)`
- **Digimon V-Pet** care formula — needs decay with sigmoid curves (decay accelerates as needs deplete)
- **Tamagotchi** evolution tree — care quality + age gates branching

---

## Verification Plan

Each phase ends with these tests **before moving on**:

### Phase 1 (Care loop)

- [ ] Background app for 4h → reopen → hunger has decayed correctly (server-side, not client)
- [ ] Change device clock forward 24h → server rejects spoofed needs restoration
- [ ] Push notification fires within 5 min of hunger < 20

### Phase 3 (Farming)

- [ ] Plant carrot → wait 15 min → harvest succeeds; harvest at 14:59 fails
- [ ] Change device clock → server still gates ready_at
- [ ] Sell crop → coin_ledger has new row with correct delta

### Phase 6 (Battle)

- [ ] Same replay seed produces identical animations on two devices
- [ ] Server simulation matches client preview to the HP point
- [ ] Trophy math is reconciled: attacker_delta + defender_delta = 0 (zero-sum)

### Pre-launch (Phase 8)

- [ ] 100-coin economy reconciliation: sum(coin_ledger.delta) per user == users.balance for all users
- [ ] Load test: 1000 concurrent users on Supabase free tier (will likely need to upgrade to Pro before launch)
- [ ] Anti-cheat smoke: bot script tries 1000 fake battle wins → server rejects all
- [ ] Crash-free rate > 99% on iOS, Android, WebGL across last 7 days of beta

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Scope creep** ("everything at once") | Strict phase gates. No phase N+1 until phase N passes verification. |
| **Art cost balloons** | Cap v1.0 at 18 monster forms. Use Meshy.ai for first-pass models, commission only your hero monsters. |
| **Battle desync between client and server** | `shared/` directory with identical math. Snapshot tests run on every commit. |
| **Notification fatigue** | Cap at 2 alerts/day per user. User can mute. |
| **Crypto regulatory risk** | Do not market tokens in v1. Add only after legal review of the specific token model. |
| **Solo-dev burnout** | Phase 1 must feel fun by week 5. If it doesn't, pivot before sinking 6 months. |
| **Mobile store rejection** | No "play to earn" language in store listing for v1.0. Standard freemium classification. |

---

## Critical files to be created (top of file tree)

- `client/Assets/Scripts/Core/GameManager.cs` — entry point, scene routing
- `client/Assets/Scripts/Net/ApiClient.cs` — single source of truth for server calls
- `client/Assets/Scripts/Pet/PetState.cs` — single source of truth for monster data on client
- `server/supabase/migrations/001_users.sql` … `006_ledger.sql` — DB schema
- `server/supabase/functions/tick-needs/index.ts` — hourly cron decaying needs server-side
- `server/supabase/functions/battle-simulate/index.ts` — authoritative battle sim
- `shared/battle-formulas/damage.ts` (+ C# port) — same math in two languages
- `design/GDD.md` — game design doc, updated as you build
- `design/balance.xlsx` — every number in the game lives here, exported to JSON

---

## Immediate next steps (when you exit plan mode)

1. Install **Unity Hub** + **Unity 2022.3 LTS** with WebGL, Android, iOS build modules
2. Create the **Supabase** project (free tier)
3. Initialize the repo structure above
4. Scaffold migrations 001–006 (empty tables, RLS policies)
5. Build a "boot" scene that authenticates against Supabase and shows a placeholder cube — proves the pipeline end-to-end before any art arrives
6. Buy **Synty POLYGON Adventure** + **DOTween Pro** to unblock art
7. Start Phase 1 (care loop) with the placeholder cube as the monster — replace with real model once commissioned

---

## Open questions to revisit later (not blockers for v1.0)

- Which exact chain for v2 tokens — Solana (fast/cheap, smaller wallet base) vs Polygon (Ethereum-compatible, easier exchanges)?
- Voice / SFX for monsters — recorded or generated (ElevenLabs)?
- Guilds / clans in v1.0 or v1.1?
- Trading monsters between players — v1.1 (with the player market)?
