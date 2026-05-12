# Smooth Giraffe — Game Design Document

**Version 1.0** · Last updated 2026-05-12 · Status: Design Phase

> This GDD is the source of truth for game design. The master execution plan lives at `C:\Users\Zen See\.claude\plans\i-want-to-create-smooth-giraffe.md` and governs *how* we build; this doc governs *what* we build.

---

## 1. Vision

A 3D chibi virtual pet game where every player has a collection of monsters they hatch, raise, train, battle, and trade. Digimon's depth meets Pokémon's collectibility meets Hay Day's daily-return loop.

**Core pillars**:
1. **Care drives evolution** — the bond you build shapes what your monster becomes.
2. **The dex is sacred** — every pet is a distinct, collectible identity.
3. **Trading creates community** — players need each other to complete their dex.
4. **Time, not money, is the main resource** — pay-to-skip is fine; pay-to-win is not.

---

## 2. Pet Collection (Dex)

### Launch scope (v1.0)
- **30 base pets** at launch
- Monthly content drops of **8–10 new pets** through year 1 → ~100 pets total by month 12
- Each pet has a fixed evolution chain (1–3 stages)

### Rarity tiers

| Tier | % of base dex | Border | Trade-ability |
|---|---|---|---|
| 🩶 Common | 50% (15 of 30) | Gray | Freely tradable |
| 🟢 Uncommon | 30% (9 of 30) | Green | Freely tradable |
| 🔵 Rare | 12% (4 of 30) | Blue | Freely tradable |
| 🟣 Epic | 6% (2 of 30) | Purple | Freely tradable |
| 🟠 Legendary | 2% (1 of 30 — *one* legendary at launch) | Gold | Tradable, but 7-day cooldown on receipt |
| 🌈 Mythic | Event-rotating, not in base dex | Holographic | Bound to account first 30 days, then tradable |

Rarity is per-species (not per-individual). Every Fire-Cub is Common; every Crystal-Dragon is Epic. Future system: shiny variants of any pet (1/4096 hatch chance) for cosmetic prestige.

### Evolution chains

- Roughly **12 evolution lines** across the 30 launch pets
- Distribution:
  - 6 lines × 3 stages = 18 dex slots
  - 4 lines × 2 stages = 8 dex slots
  - 4 standalone pets = 4 dex slots
- Evolution path depends on **care quality (avg mood last 7 days)**, **stat training**, and **items used**
- Some evolutions branch (high-mood path vs. low-mood path)

---

## 3. Currencies

Four currencies, each with one clear job. No currency overlaps another's role.

| Currency | Symbol | Earned from | Spent on | Cap |
|---|---|---|---|---|
| **Coins** | 🪙 | Farming, daily play, selling crops, low-tier battle wins | Common eggs, food, basic items, seeds | Soft cap 999,999 |
| **Gems** | 💎 | High-tier battle wins, achievements, weekly login | Rare/Epic eggs, accessories, plot expansions | None |
| **Stardust** | ✨ | Events only, trade transactions (small %) | Mythic eggs, exclusive cosmetics, event shop | None — *crypto-bridge candidate for v2* |
| **Trade Tickets** | 🎟️ | Daily quests (3/day max), weekly events | Required to *initiate* any trade (1 ticket per trade) | 30 tickets |

**Why Trade Tickets exist**: prevents trade-spam exploits, prevents bots flooding the market, gives daily login a purpose, makes trades feel valuable.

**Stardust as future token**: in v2 we may wrap Stardust as an on-chain token (Solana SPL or Polygon ERC-20). Until then, it's purely in-game with no off-ramp. **Do not market Stardust as a "token" in v1.0.**

---

## 4. Egg Shop & Gacha

### Egg tiers

| Egg | Cost | Hatch time | Drop table |
|---|---|---|---|
| 🥚 Common Egg | 100 coins | 5 min | 70% Common · 25% Uncommon · 4% Rare · 1% Epic |
| 🟢 Rare Egg | 500 coins **or** 50 gems | 30 min | 50% Uncommon · 35% Rare · 12% Epic · 3% Legendary |
| 🟣 Epic Egg | 30 gems | 2 hours | 60% Rare · 30% Epic · 10% Legendary |
| 🌈 Mythic Egg | Event-only, **or** 100 stardust during event | 6 hours | 50% Legendary · 50% Mythic |

Hatch time runs in real-world wall-clock — same server-authoritative model as the farm timers.

### Pity system (mandatory — legal + ethical)

| Threshold | Guarantee |
|---|---|
| 50 pulls without Rare+ | Next pull guaranteed Rare+ |
| 100 pulls without Epic+ | Next pull guaranteed Epic+ |
| 200 pulls without Legendary | Next pull guaranteed Legendary |

Counters are **per-egg-tier** and persist across sessions. They reset when the threshold is hit.

### Published drop rates

All drop rates **must be visible inside the egg shop UI**. This is:
- Legally required in Japan, South Korea, China, and increasingly the EU
- Apple App Store and Google Play store policy
- An ethical baseline

### Anti-exploitation rules

- **No real-money purchase of Eggs directly** in v1.0. Players buy coins/gems with money, then buy eggs with currency. (One step of abstraction = much safer regulatory posture.)
- **Daily egg purchase cap**: 10 eggs/day total across all tiers. Prevents whale spiral.
- **No "open 10 eggs at once" button** — each egg opens individually with a small animation. Reduces gambling-loop dopamine intensity.

### Event eggs

- 1 themed event per month (Spring Bloom, Summer Festival, Halloween Spook, Winter Frost, Lunar New Year, etc.)
- Event drops Mythic Eggs in event-specific quests
- Mythic pets retire after the event window (typically 3 weeks)
- Players who missed the event can sometimes acquire the pet via trading — fueling the trade economy

---

## 5. Trading

Two trade modes, both shipping in v1.0.

### Mode A: Direct Trade (friend invite)

1. Both players online (or asynchronously via "trade request inbox")
2. Player A invites Player B by username
3. Both players add pets + coins to their side of the offer
4. Both players hit Confirm twice (industry-standard double-confirm to prevent scams)
5. Server escrow holds both sides
6. Trade completes, server logs in `trade_history`

### Mode B: Async Offer Board (Pokémon GTS style)

1. Player A posts: "I'll trade my Common Fire-Cub for a Common Water-Pup + 200 coins"
2. Offer appears on a public board, indexable by species/rarity
3. Player B browses, fulfills any offer that matches
4. Server validates inventory + escrow + completes
5. Player A receives Water-Pup + 200 coins; Player B receives Fire-Cub

### Trade rules

- **1 Trade Ticket** consumed per trade (either side; initiator pays)
- **24-hour cooldown** on freshly hatched / freshly evolved pets (anti-fraud)
- **Starter pet cannot be traded** (anti account-resale; players keep a sentimental "first pet")
- **7-day cooldown** on receipt for Legendary+ pets
- **Mythic pets**: account-bound for first 30 days, then tradable
- **Trade audit log**: every trade is append-only in `trade_history` (regulator-safe + cheat-detection)
- **Trade tax**: 5% of any coin amount in a trade goes to a sink — keeps the economy from inflating, and the 5% mints a small stardust reward (~1 stardust per 1000 coins traded)

### Anti-bot

- New accounts can't trade for first **48 hours**
- Trade volume cap: **20 trades / day**
- Suspicious pattern detection on async board (same offer reposted 50× → flag)

---

## 6. Events

### Cadence

- **Monthly headline event** — 3-week window, themed (e.g. "Halloween Spook")
- **Weekly mini-event** — login bonus, double-XP weekend, etc.
- **Surprise drop events** — 24-hour flash event with bonus rewards (announced via push notification)

### Headline event structure

Every monthly event has the same 5 elements:

1. **Event egg** (Mythic-only) — drops the event's exclusive pet
2. **Event currency** — temporary, expires at event end (e.g. "Spooky Candy"); used in event shop
3. **Event quests** — themed daily quests that reward event currency, stardust, and the event egg
4. **Event shop** — cosmetics, accessories, decorations themed to the event
5. **Event leaderboard** — top 100 players each get a Mythic-tier reward

### Why monthly events matter for the business

- **Retention**: gives lapsed players a reason to return ("Halloween Pet, only 3 days left!")
- **FOMO**: drives engagement without pay-to-win
- **Trade economy fuel**: Mythics from past events trade for premium → keeps the offer board lively
- **Content velocity**: 12 events/year × ~1 mythic each = natural roadmap for year 1

---

## 7. Care Loop *(unchanged from master plan — abbreviated here)*

| Need | Decay rate | Restored by |
|---|---|---|
| Hunger | -10/hour | Food items, harvested crops |
| Cleanliness | -8/hour, +20 after meals | Soap, bath items |
| Energy | -12/hour | Sleep |
| Mood | derived | All of the above + petting + play |

Mood <30 sustained 24h → "rebellious" evolution branch. Mood >80 sustained → "loyal" branch. Bad care never causes pet death in v1.0 (too punishing for collection game; revisit post-launch).

---

## 8. Farming *(unchanged from master plan — abbreviated)*

3×3 plot, expandable to 6×6. Five crops in v1.0 (Carrot, Wheat, Strawberry, Apple Tree, Golden Mushroom). Real-time, server-authoritative.

---

## 9. Training & Battle *(unchanged from master plan)*

5 stats (HP, ATK, DEF, SPD, INT) trained via 4 mini-games. Async PvP, deterministic replay, trophy ladder with 5 leagues (Bronze → Champion).

**New for the collection game**: battle drops include a small chance at a Common/Uncommon egg fragment. Collect 10 fragments → 1 free egg. Gives non-paying players a clear path to collection growth.

---

## 10. Updated Database Schema

In addition to the schema in the master plan, the gacha + trade + events systems require:

```sql
-- Rarity & dex
ALTER TABLE monster_species ADD COLUMN rarity TEXT;       -- common|uncommon|rare|epic|legendary|mythic
ALTER TABLE monster_species ADD COLUMN dex_number INT;
ALTER TABLE monster_species ADD COLUMN is_event_only BOOLEAN DEFAULT FALSE;
ALTER TABLE monster_species ADD COLUMN evolution_line_id INT;

-- Eggs
egg_types (
  id, name, tier, price_coins NULL, price_gems NULL, price_stardust NULL,
  hatch_seconds, drop_table_id
)

drop_tables (
  id, name, weights_json  -- e.g. {"common":0.7,"uncommon":0.25,"rare":0.04,"epic":0.01}
)

owned_eggs (
  id, owner_id, egg_type_id, hatched_at NULL, ready_at,
  predetermined_species_id  -- rolled at purchase, not at hatch (transparent gacha)
)

pity_counters (
  user_id, egg_tier,
  pulls_since_rare, pulls_since_epic, pulls_since_legendary,
  PRIMARY KEY(user_id, egg_tier)
)

-- Currencies (4 ledgers, append-only)
coins_ledger    (id, user_id, delta, reason, ref_id, created_at)
gems_ledger     (id, user_id, delta, reason, ref_id, created_at)
stardust_ledger (id, user_id, delta, reason, ref_id, created_at)
tickets_ledger  (id, user_id, delta, reason, ref_id, created_at)

-- Trades
trades (
  id, mode TEXT,             -- 'direct' | 'async'
  initiator_id, target_id NULL,  -- target_id null for async-offer
  initiator_offer_json,      -- {monsters:[], coins:0, items:{}}
  target_offer_json,
  status TEXT,               -- pending|accepted|completed|cancelled|expired
  expires_at, created_at, completed_at NULL
)

trade_history (id, trade_id, payload_json, completed_at)   -- append-only audit log

-- Events
events (id, name, theme, start_at, end_at, config_json)
event_quests (id, event_id, name, requirement_json, reward_json)
event_progress (user_id, event_id, quest_id, completed_at)
event_leaderboard (user_id, event_id, score, rank)

-- Bot / fraud prevention
account_flags (user_id, flag_type, severity, created_at)
trade_velocity (user_id, day, trade_count)
```

All gacha rolls happen **server-side at egg purchase time** (not hatch time) — the pet is predetermined when you buy the egg. This is auditable, fairness-provable, and prevents client-side reroll cheats.

---

## 11. Updated Build Phases

The 24-week plan in the master plan expands to **~31 weeks (~7 months)** with the new scope. Phase delta:

| Phase | Was | Now | Change |
|---|---|---|---|
| 0. Foundations | wk 1–2 | wk 1–2 | same |
| 1. Care loop | wk 3–5 | wk 3–5 | same |
| 2. Evolution + 30-pet dex + rarity | wk 6–8 | wk 6–10 | **+2 wk** (full dex of 30) |
| 3. Farming | wk 9–11 | wk 11–13 | shift |
| 4. Shop + inventory + **eggs/gacha + pity** | wk 12–13 | wk 14–16 | **+1 wk** (gacha + pity) |
| 5. Training | wk 14–15 | wk 17–18 | shift |
| 6. Battle | wk 16–20 | wk 19–23 | shift |
| **7. Trading + Events** *(NEW)* | — | wk 24–27 | **+4 wk** |
| 8. Polish | wk 21–23 | wk 28–30 | shift |
| 9. Soft launch | wk 24 | wk 31 | shift |

**Total: 31 weeks** (~7.5 months), assuming ~4 focused hours/day with bought/commissioned art. Add ~2 weeks if monster art is slow to arrive.

---

## 12. Open design questions to revisit before launch

- **Shiny variants?** 1/4096 hatch chance for a recolored version of any pet — purely cosmetic prestige. Easy to add, big collection driver. Decision: probably yes for v1.1.
- **Pet death** in care loop? Decision: **NO** for v1.0 — too punishing for collection game. Revisit if hardcore mode requested.
- **Marriage / breeding** to produce eggs? Decision: defer to v1.2 — needs careful design to not break the rarity economy.
- **Guild/clan system**? Decision: v1.1 — needs trade system to be stable first.
- **Real-money currency purchases**? Decision: yes for v1.0 (Coins + Gems packs), but **no direct real-money egg purchases** (regulatory shield).

---

## 13. Monetization Plan (v1.0)

| Pack | Real-money price | Contents |
|---|---|---|
| Starter Bundle | $4.99 | 1000 coins + 100 gems + 3 trade tickets |
| Adventurer Pack | $9.99 | 2500 coins + 250 gems + 10 trade tickets |
| Pro Bundle | $19.99 | 6000 coins + 600 gems + 25 trade tickets + 1 random Rare egg |
| Battle Pass (monthly) | $4.99/mo | Daily rewards + 50 gems + 10 tickets + cosmetic skin |

**No direct egg purchases with real money.** **No pet purchases with real money.** Always one layer of abstraction (currency → eggs → maybe pet). This keeps us out of the "lootbox" regulatory crosshairs in most jurisdictions.

**Ethics line**: revenue per player should never correlate with win rate in PvP. PvP rewards are skill + care quality + collection breadth, not wallet size.
