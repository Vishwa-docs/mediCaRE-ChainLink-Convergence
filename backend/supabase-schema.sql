-- ─── mediCaRE Supabase Schema ──────────────────────────────────────────────
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- This creates the tables needed for auth, sessions, World ID, and audit.
-- ──────────────────────────────────────────────────────────────────────────────

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  wallet_address  TEXT   UNIQUE NOT NULL,
  display_name    TEXT   NOT NULL DEFAULT '',
  role            TEXT   NOT NULL DEFAULT 'patient',
  password_hash   TEXT,
  email           TEXT   UNIQUE,
  worldid_nullifier TEXT UNIQUE,
  worldid_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- World ID verifications
CREATE TABLE IF NOT EXISTS worldid_verifications (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nullifier_hash  TEXT   NOT NULL,
  action          TEXT   NOT NULL DEFAULT 'verify-human',
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT   NOT NULL,
  details    TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_nullifier ON users(worldid_nullifier);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
-- The backend uses the service_role key, so RLS is bypassed.
-- But we enable it for safety if anyone tries to use the anon key.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldid_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow the service_role full access (this is the default, but explicit is better)
CREATE POLICY "Service role full access on users" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on worldid_verifications" ON worldid_verifications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on audit_log" ON audit_log
  FOR ALL USING (true) WITH CHECK (true);
