-- ============================================================
-- FOOTBALL CHALLENGES (FM24 & EAFC 26)
-- ============================================================
CREATE TABLE IF NOT EXISTS football_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK (game IN ('FM24', 'EAFC26')),
  team_name TEXT NOT NULL,
  league TEXT,
  country TEXT,
  challenge_title TEXT NOT NULL,
  challenge_type TEXT, -- e.g. 'Fallen Giant', 'Youth Only', 'Journeyman', 'Moneyball', 'Custom'
  description TEXT,
  objectives JSONB DEFAULT '[]'::jsonb, -- Array of { id: string, text: string, status: 'pending' | 'completed' | 'failed' }
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Abandoned')),
  seasons_played INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE football_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "football_challenges_own" ON football_challenges FOR ALL USING (auth.uid() = user_id);
