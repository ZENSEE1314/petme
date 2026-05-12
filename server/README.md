# Smooth Giraffe — Backend

Supabase project: Postgres + Auth + Edge Functions (Deno).

## Setup

1. Create a project at https://supabase.com (free tier is fine for development).
2. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```
3. Link this folder to your project:
   ```bash
   cd server
   supabase link --project-ref <your-project-ref>
   ```
4. Push migrations (creates schema + RLS + seeds initial 30-pet dex):
   ```bash
   supabase db push
   ```
5. Deploy edge functions:
   ```bash
   supabase functions deploy tick-needs --no-verify-jwt
   supabase functions deploy buy-egg
   supabase functions deploy hatch-egg
   supabase functions deploy farm-claim
   supabase functions deploy battle-simulate
   supabase functions deploy trade-execute
   ```
6. Set required env vars (Settings → Edge Functions → Manage secrets):
   - `CRON_SECRET` — random string, required by `tick-needs` cron
7. Schedule the cron job (Dashboard → Edge Functions → tick-needs → Schedule):
   ```
   0 * * * *    every hour at :00
   ```
   Header: `X-Cron-Secret: <CRON_SECRET>`

## Layout

```
server/
└── supabase/
    ├── migrations/                 # SQL schema, run in order 001 → 010
    │   ├── 001_users.sql           # users, account_flags, auto-create trigger
    │   ├── 002_monsters.sql        # species (dex) + owned monsters
    │   ├── 003_inventory.sql       # items_catalog + per-user inventory
    │   ├── 004_economy.sql         # 4-currency ledger + balances view + caps
    │   ├── 005_eggs.sql            # egg types, owned eggs, pity counters
    │   ├── 006_farm.sql            # farm_plots + auto-seed-9-plots trigger
    │   ├── 007_battles.sql         # async PvP records + egg fragments
    │   ├── 008_trades.sql          # trades (direct + async) + audit log
    │   ├── 009_events.sql          # monthly events + quests + leaderboards
    │   └── 010_seed.sql            # initial 30-pet dex + items + egg types
    └── functions/
        ├── _shared/supabase.ts     # auth helper + clients
        ├── tick-needs/             # cron: decay hunger/cleanliness/energy hourly
        ├── buy-egg/                # gacha pull (server-authoritative, pity-aware)
        ├── hatch-egg/              # open ready egg → new monster
        ├── farm-claim/             # server-authoritative harvest (clock-cheat proof)
        ├── battle-simulate/        # async PvP fight + deterministic replay
        └── trade-execute/          # atomic trade settlement with 5% tax sink
```

## Architectural rules

1. **Append-only ledger.** Every coin/gem/stardust/ticket change is a `currency_ledger` row. Balances are a view (`user_balances`) — never stored. This gives perfect audit and reconciliation.
2. **Server-authoritative timers.** Hatch, farm grow, trade expiry — all use server `NOW()` checks. Device clock cheats are blocked.
3. **Predetermined gacha rolls.** When you buy an egg, the species inside is rolled SERVER-SIDE AT THAT MOMENT and stored in `owned_eggs.predetermined_species_id`. Hatching just reveals it. Eliminates client-side reroll exploits and makes drop rates legally auditable.
4. **RLS on everything.** Players read public data (species catalog, leaderboards, async-offer board) but only write via edge functions (service-role).
5. **Pity counters per egg tier.** 50/100/200 pull guarantees for Rare/Epic/Legendary — enforced server-side in `buy-egg`.
6. **Same battle math both sides.** Server (Deno/TS) and client (Unity/C#) must produce identical battle outcomes from the same `replay_seed`. The TS implementation in `battle-simulate` is the source of truth.

## Local development

```bash
cd server
supabase start              # spins up local Postgres + Studio
supabase db reset           # nukes and replays all migrations
supabase functions serve    # runs edge functions locally on :54321
```

## Verification

After deploy, run these to smoke-test:

```bash
# Smoke test: confirm dex was seeded
psql $DATABASE_URL -c "SELECT COUNT(*) FROM monster_species;"
# Expected: 30

# Smoke test: confirm RLS is on
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = TRUE;"
# Expected: every table in our schema
```

Phase 1 verification (after building care loop on top):

```sql
-- Verify hourly decay
SELECT id, hunger, last_tick_at FROM monsters WHERE owner_id = '<test_user>';
-- Wait 1 hour, run again, hunger should drop by ~10
```

## Pending edge functions (not yet implemented)

These have schemas + database rows ready but no function code yet. Add as you hit each phase:

- `feed-pet` — apply food effect, restore needs (Phase 1)
- `plant-seed` — start farm timer (Phase 3)
- `water-plot` — +20% yield (Phase 3)
- `shop-buy` — generic item purchase (Phase 4)
- `train-monster` — apply training gear, +stat (Phase 5)
- `match-find` — split match-finding logic out of battle-simulate (Phase 6)
- `trade-create` — create a pending trade (Phase 7)
- `trade-accept` — async offer board acceptor (Phase 7)
- `trade-cancel` — cancel pending trade (Phase 7)
- `event-tick` — daily/weekly event quest refresh cron (Phase 7)
