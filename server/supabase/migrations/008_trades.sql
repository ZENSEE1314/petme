-- ============================================================
-- 008_trades.sql — Player-to-player trading
-- Two modes: direct invite (Mode A) and async offer board (Mode B)
-- ============================================================

CREATE TYPE trade_mode AS ENUM ('direct','async');
CREATE TYPE trade_status AS ENUM ('pending','accepted','completed','cancelled','expired','rejected');

CREATE TABLE IF NOT EXISTS trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            trade_mode NOT NULL,
  initiator_id    UUID NOT NULL REFERENCES users(id),
  target_id       UUID REFERENCES users(id),     -- NULL for async-offer (open market)
  fulfilled_by    UUID REFERENCES users(id),     -- who actually accepted the async offer

  -- What initiator is offering
  initiator_offer JSONB NOT NULL,
    -- {"monsters":["uuid1","uuid2"], "coins":500, "items":[{"item_id":12,"qty":3}]}

  -- What initiator wants in return (for async: required match; for direct: target's counter-offer)
  target_offer    JSONB NOT NULL,

  status          trade_status NOT NULL DEFAULT 'pending',
  initiator_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  target_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_trades_initiator   ON trades(initiator_id, status);
CREATE INDEX idx_trades_target      ON trades(target_id, status) WHERE target_id IS NOT NULL;
CREATE INDEX idx_trades_async_open  ON trades(created_at DESC) WHERE mode = 'async' AND status = 'pending';

-- ============================================================
-- trade_history — append-only audit log (regulator-safe)
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_history (
  id           BIGSERIAL PRIMARY KEY,
  trade_id     UUID NOT NULL REFERENCES trades(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL,           -- 'created','confirmed','cancelled','completed','expired'
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_history_trade ON trade_history(trade_id, created_at);
CREATE INDEX idx_trade_history_user  ON trade_history(user_id, created_at DESC);

-- ============================================================
-- trade_velocity — anti-bot daily counter
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_velocity (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  trade_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_velocity ENABLE ROW LEVEL SECURITY;

-- Trade visibility:
--   - Direct trades: both initiator and target can see
--   - Async trades while pending: everyone can browse the public offer board
--   - Async trades after completion: only the two parties
CREATE POLICY "trades_read_visible" ON trades FOR SELECT USING (
  auth.uid() = initiator_id
  OR auth.uid() = target_id
  OR auth.uid() = fulfilled_by
  OR (mode = 'async' AND status = 'pending')
);

CREATE POLICY "trade_history_read_self" ON trade_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "velocity_read_self" ON trade_velocity FOR SELECT
  USING (auth.uid() = user_id);
