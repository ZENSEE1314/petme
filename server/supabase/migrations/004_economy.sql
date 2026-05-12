-- ============================================================
-- 004_economy.sql — Unified currency ledger + balances view
-- 4 currencies: coins, gems, stardust, tickets
-- Append-only design (full audit trail, cheat-proof, reconcilable)
-- ============================================================

CREATE TYPE currency_kind AS ENUM ('coins','gems','stardust','tickets');

CREATE TABLE IF NOT EXISTS currency_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency   currency_kind NOT NULL,
  delta      BIGINT NOT NULL,        -- positive = credit, negative = debit
  reason     TEXT NOT NULL,          -- 'shop_buy', 'battle_win', 'farm_sell', 'trade_tax', 'event_quest', etc.
  ref_id     TEXT,                   -- foreign reference (battle.id, trade.id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_user_currency_time
  ON currency_ledger(user_id, currency, created_at DESC);

CREATE INDEX idx_ledger_reason ON currency_ledger(reason);

-- ============================================================
-- balances view — current balance per currency, derived from ledger
-- ============================================================

CREATE OR REPLACE VIEW user_balances AS
SELECT
  u.id AS user_id,
  COALESCE(SUM(cl.delta) FILTER (WHERE cl.currency = 'coins'),    0) AS coins,
  COALESCE(SUM(cl.delta) FILTER (WHERE cl.currency = 'gems'),     0) AS gems,
  COALESCE(SUM(cl.delta) FILTER (WHERE cl.currency = 'stardust'), 0) AS stardust,
  COALESCE(SUM(cl.delta) FILTER (WHERE cl.currency = 'tickets'),  0) AS tickets
FROM users u
LEFT JOIN currency_ledger cl ON cl.user_id = u.id
GROUP BY u.id;

-- ============================================================
-- Currency cap enforcement (server-side check before insert)
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_currency_caps()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  current_balance BIGINT;
  new_balance BIGINT;
BEGIN
  SELECT COALESCE(SUM(delta), 0) INTO current_balance
  FROM currency_ledger
  WHERE user_id = NEW.user_id AND currency = NEW.currency;

  new_balance := current_balance + NEW.delta;

  -- Caps from GDD
  IF NEW.currency = 'coins'   AND new_balance > 999999 THEN
    RAISE EXCEPTION 'coin cap exceeded (999,999): would be %', new_balance;
  ELSIF NEW.currency = 'tickets' AND new_balance > 30 THEN
    RAISE EXCEPTION 'ticket cap exceeded (30): would be %', new_balance;
  END IF;

  -- Never allow negative balance
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient %: have %, attempted %', NEW.currency, current_balance, NEW.delta;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_currency_caps
  BEFORE INSERT ON currency_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_currency_caps();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE currency_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_read_self" ON currency_ledger FOR SELECT USING (auth.uid() = user_id);
-- INSERTS only through edge functions (service role)
