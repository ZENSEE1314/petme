-- ============================================================
-- 009_events.sql — Monthly themed events
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id          INT PRIMARY KEY,
  name        TEXT NOT NULL,
  theme       TEXT NOT NULL,                   -- 'halloween', 'winter_frost', 'spring_bloom'
  description TEXT,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- theme-specific config (currency name, etc.)
  is_active   BOOLEAN GENERATED ALWAYS AS (NOW() BETWEEN start_at AND end_at) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_active ON events(is_active) WHERE is_active;
CREATE INDEX idx_events_dates  ON events(start_at, end_at);

-- ============================================================
-- event_quests — daily / weekly tasks during an event
-- ============================================================

CREATE TABLE IF NOT EXISTS event_quests (
  id              SERIAL PRIMARY KEY,
  event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  requirement     JSONB NOT NULL,
    -- e.g. {"type":"win_battles","count":5}
    --      {"type":"hatch_eggs","count":3}
    --      {"type":"harvest_crops","count":10}
  reward          JSONB NOT NULL,
    -- e.g. {"stardust":50, "event_currency":100, "trade_tickets":1}
  refresh_cadence TEXT NOT NULL DEFAULT 'event_once'
                    CHECK (refresh_cadence IN ('event_once','daily','weekly')),
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quests_event ON event_quests(event_id);

-- ============================================================
-- event_progress — per-user quest completion
-- ============================================================

CREATE TABLE IF NOT EXISTS event_progress (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id       INT NOT NULL REFERENCES events(id),
  quest_id       INT NOT NULL REFERENCES event_quests(id),
  refresh_key    TEXT NOT NULL DEFAULT '',   -- '' for event_once, '2026-W19' for weekly, '2026-05-12' for daily
  progress       INT NOT NULL DEFAULT 0,
  completed_at   TIMESTAMPTZ,
  PRIMARY KEY (user_id, event_id, quest_id, refresh_key)
);

CREATE INDEX idx_progress_user_event ON event_progress(user_id, event_id);

-- ============================================================
-- event_leaderboard — top players per event
-- ============================================================

CREATE TABLE IF NOT EXISTS event_leaderboard (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    INT NOT NULL REFERENCES events(id),
  score       BIGINT NOT NULL DEFAULT 0,
  rank        INT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_leaderboard_event_rank ON event_leaderboard(event_id, score DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_read_all"          ON events FOR SELECT USING (TRUE);
CREATE POLICY "event_quests_read_all"    ON event_quests FOR SELECT USING (TRUE);
CREATE POLICY "event_progress_read_self" ON event_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "leaderboard_read_all"     ON event_leaderboard FOR SELECT USING (TRUE);
