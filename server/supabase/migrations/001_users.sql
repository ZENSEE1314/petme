-- ============================================================
-- 001_users.sql — User accounts, trophies, account flags
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT UNIQUE NOT NULL CHECK (char_length(display_name) BETWEEN 3 AND 20),
  avatar_url    TEXT,
  trophies      INT NOT NULL DEFAULT 0,
  league        TEXT NOT NULL DEFAULT 'bronze'
                  CHECK (league IN ('bronze','silver','gold','diamond','champion')),
  -- v2 crypto bridge fields (empty in v1.0)
  wallet_address TEXT,
  wallet_chain   TEXT CHECK (wallet_chain IN ('solana','polygon','ethereum') OR wallet_chain IS NULL),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_trophies ON users(trophies DESC);
CREATE INDEX idx_users_last_seen ON users(last_seen_at DESC);

-- Anti-fraud: flag table for suspicious accounts (bot, multi-account, exploit)
CREATE TABLE IF NOT EXISTS account_flags (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type   TEXT NOT NULL,
  severity    INT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_account_flags_user ON account_flags(user_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_flags ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (display names visible publicly), edit only their own
CREATE POLICY "users_read_all"    ON users FOR SELECT USING (TRUE);
CREATE POLICY "users_update_self" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_self" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Account flags: only the user can see their own; only service role can write
CREATE POLICY "flags_read_self" ON account_flags FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Auto-create user row on auth.users insert
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'player_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
