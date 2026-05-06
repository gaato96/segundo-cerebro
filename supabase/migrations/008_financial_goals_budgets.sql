-- ============================================================
-- SEGUNDO CEREBRO — Finances: Budgets & Financial Goals
-- ============================================================

-- ============================================================
-- MONTHLY BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- e.g. '2026-03'
  incomes_json JSONB DEFAULT '[]',
  expenses_json JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- ============================================================
-- FINANCIAL GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) DEFAULT 0,
  target_date DATE,
  color_hex TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_budgets_own" ON monthly_budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "financial_goals_own" ON financial_goals FOR ALL USING (auth.uid() = user_id);
