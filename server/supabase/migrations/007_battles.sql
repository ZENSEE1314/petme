-- ============================================================
-- 007_battles.sql — Async PvP battles, deterministic replays
-- ============================================================

CREATE TYPE battle_result AS ENUM ('attacker_win','defender_win','draw');

CREATE TABLE IF NOT EXISTS battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id     UUID NOT NULL REFERENCES users(id),
  defender_id     UUID NOT NULL REFERENCES users(id),

  -- Team snapshots at battle time (immutable — players can change teams afterward)
  attacker_team   JSONB NOT NULL,    -- [{species_id, level, hp, atk, def, spd, intl, nickname}, ...]
  defender_team   JSONB NOT NULL,

  result          battle_result NOT NULL,
  replay_seed     BIGINT NOT NULL,            -- deterministic PRNG seed for client re-simulation
  replay_log      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- list of moves for client to animate

  trophy_delta_atk INT NOT NULL,              -- +20 typical win, -10 typical loss (zero-sum)
  trophy_delta_def INT NOT NULL,

  coins_reward    INT NOT NULL DEFAULT 0,
  gems_reward     INT NOT NULL DEFAULT 0,
  egg_fragment_drop BOOLEAN NOT NULL DEFAULT FALSE,  -- 5% chance, 10 frags = 1 free Common egg

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_battles_attacker ON battles(attacker_id, created_at DESC);
CREATE INDEX idx_battles_defender ON battles(defender_id, created_at DESC);
CREATE INDEX idx_battles_time     ON battles(created_at DESC);

-- ============================================================
-- egg_fragments — collect 10 to redeem a free Common egg
-- ============================================================

CREATE TABLE IF NOT EXISTS egg_fragments (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  count      INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_fragments ENABLE ROW LEVEL SECURITY;

-- Players can view battles they participated in
CREATE POLICY "battles_read_participant" ON battles FOR SELECT
  USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

CREATE POLICY "fragments_read_self" ON egg_fragments FOR SELECT USING (auth.uid() = user_id);
-- All battle writes via edge functions
