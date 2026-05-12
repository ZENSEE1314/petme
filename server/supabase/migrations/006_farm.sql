-- ============================================================
-- 006_farm.sql — Farming plots (server-authoritative timers)
-- ============================================================

CREATE TABLE IF NOT EXISTS farm_plots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index     INT NOT NULL CHECK (slot_index BETWEEN 0 AND 35),  -- supports 6x6 max (36 slots)
  is_unlocked    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Current planting
  seed_item_id   INT REFERENCES items_catalog(id),
  planted_at     TIMESTAMPTZ,
  ready_at       TIMESTAMPTZ,        -- server-computed: planted_at + crop.grow_seconds
  watered_at     TIMESTAMPTZ,        -- nullable — +20% yield if watered

  -- For permanent plots (Apple Tree etc.)
  is_permanent   BOOLEAN NOT NULL DEFAULT FALSE,
  next_harvest_at TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, slot_index)
);

CREATE INDEX idx_farm_plots_user ON farm_plots(user_id);
CREATE INDEX idx_farm_plots_ready ON farm_plots(ready_at)
  WHERE seed_item_id IS NOT NULL AND ready_at IS NOT NULL;

-- ============================================================
-- Seed initial 9 plots per user (3x3 starter farm) on user creation
-- ============================================================

CREATE OR REPLACE FUNCTION seed_starter_plots()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO farm_plots (user_id, slot_index, is_unlocked)
  SELECT NEW.id, generate_series(0, 8), TRUE;
  -- slots 9-35 stay locked, unlock via shop expansion
  INSERT INTO farm_plots (user_id, slot_index, is_unlocked)
  SELECT NEW.id, generate_series(9, 35), FALSE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_starter_plots
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION seed_starter_plots();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE farm_plots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plots_read_self" ON farm_plots FOR SELECT USING (auth.uid() = user_id);
-- Plant/water/harvest go through edge functions for clock-cheat protection
