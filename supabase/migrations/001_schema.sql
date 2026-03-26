-- ============================================================
-- SEGUNDO CEREBRO — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  pomodoro_work_mins INT DEFAULT 25,
  pomodoro_break_mins INT DEFAULT 5,
  ideal_routine_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: ensure it runs after user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- OBJECTIVES (OKRs)
-- ============================================================
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('Year', 'Q1', 'Q2', 'Q3', 'Q4')),
  type TEXT DEFAULT 'Personal' CHECK (type IN ('Professional', 'Personal')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  parent_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS (GTD)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority INT DEFAULT 2 CHECK (priority IN (1, 2, 3)), -- 1=High, 2=Medium, 3=Low
  status TEXT DEFAULT 'Todo' CHECK (status IN ('Todo', 'InProgress', 'Done')),
  category TEXT DEFAULT 'Personal' CHECK (category IN ('Work', 'Personal')),
  due_date DATE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HABITS
-- ============================================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  goal_count INT DEFAULT 1, -- times per week (for weekly habits)
  color_hex TEXT DEFAULT '#6366f1',
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

-- ============================================================
-- DEBTS
-- ============================================================
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creditor TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  remaining_amount NUMERIC(12, 2) NOT NULL,
  interest_rate NUMERIC(5, 2) DEFAULT 0,
  due_day INT CHECK (due_day BETWEEN 1 AND 31),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS finances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Fixed_Expense', 'Variable', 'Debt_Payment')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_day INT CHECK (due_day BETWEEN 1 AND 31),
  is_recurring BOOL DEFAULT FALSE,
  debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
  month_year TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'), -- e.g. '2026-03'
  category TEXT DEFAULT 'Otros',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-update debt remaining_amount on payment
CREATE OR REPLACE FUNCTION handle_debt_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'Debt_Payment' AND NEW.debt_id IS NOT NULL THEN
    UPDATE debts
    SET remaining_amount = GREATEST(remaining_amount - NEW.amount, 0)
    WHERE id = NEW.debt_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_finance_debt_payment ON finances;
CREATE TRIGGER on_finance_debt_payment
  AFTER INSERT ON finances
  FOR EACH ROW EXECUTE PROCEDURE handle_debt_payment();

-- ============================================================
-- CHILD REGISTRY (Módulo Julian)
-- ============================================================
CREATE TABLE IF NOT EXISTS child_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL DEFAULT 'Julian',
  category TEXT NOT NULL CHECK (category IN ('Health', 'Meds', 'Vaccine', 'Doc', 'Note', 'Appointment')),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  alert_date TIMESTAMPTZ,
  dose_interval_hours INT, -- for recurring meds (e.g. every 8 hours)
  last_dose_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEDIA BACKLOG (Entertainment)
-- ============================================================
CREATE TABLE IF NOT EXISTS media_backlog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Book', 'Movie', 'Series', 'Game')),
  title TEXT NOT NULL,
  author_or_studio TEXT,
  status TEXT DEFAULT 'Backlog' CHECK (status IN ('Backlog', 'Active', 'Finished')),
  progress TEXT, -- e.g. "pág 120", "Ep 5 S2"
  rating INT CHECK (rating BETWEEN 1 AND 5),
  cover_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOURNAL ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT,
  mood INT CHECK (mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ============================================================
-- WISHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12, 2),
  url TEXT,
  category TEXT DEFAULT 'Otros',
  desire_level INT DEFAULT 3 CHECK (desire_level BETWEEN 1 AND 5),
  linked_to_budget BOOL DEFAULT FALSE,
  purchased BOOL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POMODORO SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  duration_mins INT NOT NULL,
  type TEXT DEFAULT 'Focus' CHECK (type IN ('Focus', 'Break')),
  completed BOOL DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- All other tables: user_id must match authenticated user
CREATE POLICY "objectives_own" ON objectives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tasks_own" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "habits_own" ON habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "habit_logs_own" ON habit_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "debts_own" ON debts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "finances_own" ON finances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "child_registry_own" ON child_registry FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "media_backlog_own" ON media_backlog FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "journal_entries_own" ON journal_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "wishlist_own" ON wishlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pomodoro_sessions_own" ON pomodoro_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS habit_logs_habit_date ON habit_logs(habit_id, completed_at);
CREATE INDEX IF NOT EXISTS finances_user_month ON finances(user_id, month_year);
CREATE INDEX IF NOT EXISTS journal_entries_user_date ON journal_entries(user_id, date);
