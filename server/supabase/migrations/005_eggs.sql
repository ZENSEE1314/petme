-- ============================================================
-- 005_eggs.sql — Egg gacha system with published drop rates & pity
-- ============================================================

CREATE TYPE egg_tier AS ENUM ('common','rare','epic','mythic','starter','event');

-- ============================================================
-- egg_types — catalog of eggs the shop sells
-- ============================================================

CREATE TABLE IF NOT EXISTS egg_types (
  id              INT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  tier            egg_tier NOT NULL,
  description     TEXT,
  -- Pricing (NULL = not purchasable in that currency)
  price_coins     INT,
  price_gems      INT,
  price_stardust  INT,
  -- Real-time hatch wait (server-authoritative)
  hatch_seconds   INT NOT NULL DEFAULT 300,
  -- Drop table — what rarities can come out, with weights
  -- e.g. {"common":0.70, "uncommon":0.25, "rare":0.04, "epic":0.01}
  drop_weights    JSONB NOT NULL,
  -- Daily purchase limit (per user)
  daily_limit     INT,
  -- Event-only: ties to events.id
  event_id        INT,
  -- Display
  sprite_path     TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_egg_types_tier  ON egg_types(tier);
CREATE INDEX idx_egg_types_event ON egg_types(event_id) WHERE event_id IS NOT NULL;

-- ============================================================
-- owned_eggs — eggs in player inventory, predetermined contents
-- ============================================================
-- Critical design: the species hatching from the egg is rolled
-- SERVER-SIDE AT PURCHASE TIME, not at hatch time. This is auditable
-- and prevents client-side reroll cheats.

CREATE TABLE IF NOT EXISTS owned_eggs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  egg_type_id              INT NOT NULL REFERENCES egg_types(id),
  predetermined_species_id INT NOT NULL REFERENCES monster_species(id),
  predetermined_is_shiny   BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at                 TIMESTAMPTZ NOT NULL,        -- when hatching completes
  hatched_at               TIMESTAMPTZ,                  -- NULL until hatched
  acquired_from            TEXT NOT NULL                 -- 'shop' / 'event' / 'quest' / 'trade'
);

CREATE INDEX idx_owned_eggs_owner   ON owned_eggs(owner_id);
CREATE INDEX idx_owned_eggs_ready   ON owned_eggs(ready_at) WHERE hatched_at IS NULL;

-- ============================================================
-- pity_counters — per-user, per-tier streak protection
-- ============================================================

CREATE TABLE IF NOT EXISTS pity_counters (
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  egg_tier           egg_tier NOT NULL,
  pulls_since_rare      INT NOT NULL DEFAULT 0,
  pulls_since_epic      INT NOT NULL DEFAULT 0,
  pulls_since_legendary INT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, egg_tier)
);

-- ============================================================
-- daily_purchase_log — anti-spend-spiral cap (max 10 eggs/day total)
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_purchase_log (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_day DATE NOT NULL DEFAULT CURRENT_DATE,
  egg_count    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, purchase_day)
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE egg_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE owned_eggs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pity_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_purchase_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egg_types_read_all"    ON egg_types FOR SELECT USING (TRUE);
CREATE POLICY "owned_eggs_read_self"  ON owned_eggs FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "pity_read_self"        ON pity_counters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchase_log_read_self" ON daily_purchase_log FOR SELECT USING (auth.uid() = user_id);
-- All writes via edge functions (service role)
