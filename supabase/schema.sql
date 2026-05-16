-- ============================================================
-- CIRO Supabase Schema
-- Run this in your Supabase SQL editor once
-- ============================================================

-- Enable realtime for all tables
-- (done per-table below via publication)

-- ── Orchestration Cycles ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciro_cycles (
  id          SERIAL PRIMARY KEY,
  cycle_number INTEGER NOT NULL UNIQUE,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status      TEXT DEFAULT 'processing',  -- idle | alert | critical
  active_crises INTEGER DEFAULT 0,
  total_signals INTEGER DEFAULT 0,
  total_alerts  INTEGER DEFAULT 0
);

-- ── Agent Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciro_logs (
  id            TEXT PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL,
  level         TEXT NOT NULL,       -- DEBUG|INFO|SUCCESS|WARN|ERROR
  category      TEXT NOT NULL,
  agent         TEXT NOT NULL,
  action        TEXT NOT NULL,
  message       TEXT NOT NULL,
  success       BOOLEAN DEFAULT TRUE,
  duration_ms   INTEGER,
  confidence    FLOAT,
  cycle_number  INTEGER,
  request_payload  JSONB,
  response_payload JSONB,
  details          JSONB,
  error_message    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ciro_logs_cycle  ON ciro_logs(cycle_number);
CREATE INDEX IF NOT EXISTS ciro_logs_agent  ON ciro_logs(agent);
CREATE INDEX IF NOT EXISTS ciro_logs_level  ON ciro_logs(level);
CREATE INDEX IF NOT EXISTS ciro_logs_ts     ON ciro_logs(timestamp DESC);

-- ── Crisis Events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciro_crises (
  id                    TEXT PRIMARY KEY,
  cycle_number          INTEGER,
  type                  TEXT NOT NULL,
  severity              TEXT NOT NULL,
  confidence            FLOAT,
  location              TEXT NOT NULL,
  lat                   FLOAT,
  lng                   FLOAT,
  affected_radius_km    FLOAT,
  expected_duration_hours FLOAT,
  description           TEXT,
  evidence              JSONB,
  status                TEXT DEFAULT 'active',
  spread_probability    FLOAT,
  population_impact     INTEGER,
  escalation_probability FLOAT,
  time_to_peak_hours    FLOAT,
  ai_reasoning          TEXT,
  detected_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ciro_crises_cycle    ON ciro_crises(cycle_number);
CREATE INDEX IF NOT EXISTS ciro_crises_status   ON ciro_crises(status);
CREATE INDEX IF NOT EXISTS ciro_crises_severity ON ciro_crises(severity);

-- ── Resource Allocations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciro_allocations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  crisis_id       TEXT NOT NULL REFERENCES ciro_crises(id) ON DELETE CASCADE,
  cycle_number    INTEGER,
  units           JSONB NOT NULL,
  response_time_minutes INTEGER,
  reasoning       TEXT,
  confidence      FLOAT,
  allocated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciro_notifications (
  id          TEXT PRIMARY KEY,
  crisis_id   TEXT,
  channel     TEXT NOT NULL,
  severity    TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  location    TEXT,
  sent        BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ciro_notif_severity ON ciro_notifications(severity);
CREATE INDEX IF NOT EXISTS ciro_notif_channel  ON ciro_notifications(channel);

-- ── Enable Realtime ──────────────────────────────────────────
-- Run these in Supabase dashboard > Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE ciro_crises;
ALTER PUBLICATION supabase_realtime ADD TABLE ciro_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ciro_cycles;

-- ── Disable RLS for Demo/Hackathon ───────────────────────────
-- (Supabase enables RLS by default on new projects sometimes)
ALTER TABLE ciro_cycles DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciro_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciro_crises DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciro_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciro_notifications DISABLE ROW LEVEL SECURITY;
