-- ============================================================
-- 002_monsters.sql — Monster species (dex catalog) and owned monsters
-- ============================================================

-- Rarity enum
CREATE TYPE rarity_tier AS ENUM ('common','uncommon','rare','epic','legendary','mythic');

-- Element enum
CREATE TYPE element_type AS ENUM ('fire','water','grass','light','dark','neutral');

-- Evolution stage enum
CREATE TYPE evolution_stage AS ENUM ('egg','baby','child','teen','adult','mega');

-- ============================================================
-- monster_species — the dex catalog (30 at launch, ~100 by year 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS monster_species (
  id               INT PRIMARY KEY,            -- dex number (1-100+)
  name             TEXT NOT NULL UNIQUE,
  rarity           rarity_tier NOT NULL,
  element          element_type NOT NULL,
  stage            evolution_stage NOT NULL,
  evolution_line   INT NOT NULL,               -- groups species belonging to the same chain
  evolves_from     INT REFERENCES monster_species(id),
  evolution_rules  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. {"min_mood":80, "min_level":15, "required_item":"sun_stone"}
  base_stats       JSONB NOT NULL DEFAULT '{"hp":50,"atk":50,"def":50,"spd":50,"int":50}'::jsonb,
  model_path       TEXT,                       -- e.g. "Art/Monsters/fire_baby_001.prefab"
  sprite_path      TEXT,
  description      TEXT,
  is_event_only    BOOLEAN NOT NULL DEFAULT FALSE,
  is_starter       BOOLEAN NOT NULL DEFAULT FALSE,
  is_tradable      BOOLEAN NOT NULL DEFAULT TRUE,
  trade_cooldown_h INT NOT NULL DEFAULT 24,    -- 24h default, 168 for Legendary, 720 for first-30-days Mythic
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_species_rarity   ON monster_species(rarity);
CREATE INDEX idx_species_element  ON monster_species(element);
CREATE INDEX idx_species_line     ON monster_species(evolution_line);
CREATE INDEX idx_species_event    ON monster_species(is_event_only) WHERE is_event_only;

-- ============================================================
-- monsters — individual pets owned by users
-- ============================================================

CREATE TABLE IF NOT EXISTS monsters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id      INT NOT NULL REFERENCES monster_species(id),
  nickname        TEXT CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 20),
  is_starter      BOOLEAN NOT NULL DEFAULT FALSE,  -- starter pets can never be traded
  is_shiny        BOOLEAN NOT NULL DEFAULT FALSE,  -- 1/4096 cosmetic variant (v1.1+)

  -- Stats (current values; level up via XP)
  level           INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  xp              INT NOT NULL DEFAULT 0,
  hp              INT NOT NULL DEFAULT 50,
  atk             INT NOT NULL DEFAULT 50,
  def             INT NOT NULL DEFAULT 50,
  spd             INT NOT NULL DEFAULT 50,
  intl            INT NOT NULL DEFAULT 50,   -- "int" is reserved word in SQL

  -- Care needs (0-100, decay over real time, ticked by edge function)
  hunger          INT NOT NULL DEFAULT 100 CHECK (hunger BETWEEN 0 AND 100),
  cleanliness    INT NOT NULL DEFAULT 100 CHECK (cleanliness BETWEEN 0 AND 100),
  energy          INT NOT NULL DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
  mood            INT NOT NULL DEFAULT 80  CHECK (mood BETWEEN 0 AND 100),
  last_tick_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Care history (used by evolution engine)
  mood_history    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- rolling 7-day moods

  -- Trade lock
  trade_locked_until TIMESTAMPTZ,  -- if set, monster cannot be traded until this time

  -- v2 crypto bridge
  token_id        TEXT,
  metadata_uri    TEXT,
  minted_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_monsters_owner    ON monsters(owner_id);
CREATE INDEX idx_monsters_species  ON monsters(species_id);
CREATE INDEX idx_monsters_owner_species ON monsters(owner_id, species_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE monster_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;

-- Species catalog is public
CREATE POLICY "species_read_all" ON monster_species FOR SELECT USING (TRUE);

-- Players can see their own monsters AND other players' monsters (for trade browse / battle preview)
CREATE POLICY "monsters_read_all"   ON monsters FOR SELECT USING (TRUE);
CREATE POLICY "monsters_update_own" ON monsters FOR UPDATE USING (auth.uid() = owner_id);
-- INSERT/DELETE only through edge functions (service role)
