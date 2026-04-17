-- ============================================================
-- ENHANCEMENTS: Vaciado Mental, Energy Context, Daily Wins
-- ============================================================

-- 1. Mental Notes (Vaciado Mental)
CREATE TABLE IF NOT EXISTS mental_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_processed BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mental_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mental_notes_own" ON mental_notes FOR ALL USING (auth.uid() = user_id);

-- 2. Energy context for tasks
ALTER TABLE tasks
ADD COLUMN energy_level TEXT DEFAULT 'Deep Work' CHECK (energy_level IN ('Deep Work', 'Low Energy', 'Phone-only'));

-- 3. Daily Wins
CREATE TABLE IF NOT EXISTS daily_wins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  win TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_wins_own" ON daily_wins FOR ALL USING (auth.uid() = user_id);
