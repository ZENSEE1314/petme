-- ============================================================
-- 003_inventory.sql — Item catalog and player inventory
-- ============================================================

CREATE TYPE item_type AS ENUM (
  'food',         -- restores hunger
  'medicine',     -- restores cleanliness / cures status
  'toy',          -- restores mood
  'accessory',   -- cosmetic, equippable
  'seed',         -- plantable in farm
  'training_gear',-- temporary stat boost
  'battle_item',  -- usable in battle (potions, etc.)
  'evolution_stone', -- forces a specific evolution branch
  'crop'          -- harvested farm output, sellable or feedable
);

CREATE TABLE IF NOT EXISTS items_catalog (
  id             INT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  type           item_type NOT NULL,
  sub_type       TEXT,                       -- 'fruit' / 'meat' / 'rare-fruit' etc.
  description    TEXT,
  -- prices in each currency (NULL = not purchasable in that currency)
  price_coins    INT,
  price_gems     INT,
  price_stardust INT,
  -- effects when used (JSON keeps it flexible)
  effect         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. {"hunger":30,"mood":5}  or  {"stat_boost":{"atk":10,"duration":1800}}
  -- meta
  sprite_path    TEXT,
  is_tradable    BOOLEAN NOT NULL DEFAULT TRUE,
  is_consumable  BOOLEAN NOT NULL DEFAULT TRUE,
  rarity         rarity_tier NOT NULL DEFAULT 'common',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_type   ON items_catalog(type);
CREATE INDEX idx_items_rarity ON items_catalog(rarity);

-- ============================================================
-- inventory — per-user stack counts
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INT NOT NULL REFERENCES items_catalog(id),
  qty        INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX idx_inventory_user ON inventory(user_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE items_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_read_all" ON items_catalog FOR SELECT USING (TRUE);

CREATE POLICY "inventory_read_self" ON inventory FOR SELECT USING (auth.uid() = user_id);
-- Mutations through edge functions (service role only) to keep economy tamper-proof
