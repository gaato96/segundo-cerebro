-- =============================================================
-- Migration 012: Habit Custom Frequencies + Budget Projection
-- =============================================================

-- ─── HABITS: Custom Frequency ────────────────────────────────
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS frequency_type TEXT NOT NULL DEFAULT 'daily'
    CHECK (frequency_type IN ('daily', 'custom_days', 'x_per_week', 'x_per_day')),
  ADD COLUMN IF NOT EXISTS frequency_days INT[] NOT NULL DEFAULT '{}',
  -- ISO day of week: 1=Monday … 7=Sunday (e.g. [1,3,5] = Mon/Wed/Fri)
  ADD COLUMN IF NOT EXISTS frequency_times_per_day INT NOT NULL DEFAULT 1;

-- ─── BUDGET PROJECTIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_projections (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_year    TEXT            NOT NULL,        -- 'YYYY-MM'
  type          TEXT            NOT NULL CHECK (type IN ('income', 'expense')),
  description   TEXT            NOT NULL,
  amount        NUMERIC(12, 2)  NOT NULL,
  category      TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_budget_projections_user_month
  ON budget_projections (user_id, month_year);

-- RLS
ALTER TABLE budget_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bp_all ON budget_projections;
CREATE POLICY bp_all ON budget_projections
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
