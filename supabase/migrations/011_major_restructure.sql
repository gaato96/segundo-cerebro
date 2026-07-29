-- ═══════════════════════════════════════════════
-- MIGRACIÓN 011: REESTRUCTURACIÓN MAYOR SEGUNDO CEREBRO
-- ═══════════════════════════════════════════════

-- 1. EVENTS (Calendario de reuniones y eventos + Google Calendar Sync)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT DEFAULT 'event'
    CHECK (event_type IN ('meeting','event','appointment','reminder','birthday')),
  location TEXT,
  color_hex TEXT DEFAULT '#6366f1',
  is_all_day BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- 'weekly', 'monthly', 'yearly'
  google_event_id TEXT, -- ID para Sync con Google Calendar
  google_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. WEEKLY_PLANS (Planificación semanal)
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL, -- Siempre lunes
  plan_data JSONB DEFAULT '{}', -- { "monday": [...taskIds], "tuesday": [...] }
  weekly_goals TEXT,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- 3. MORNING_RITUAL_CONFIG (Configuración del ritual matutino)
CREATE TABLE IF NOT EXISTS morning_ritual_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  sections_order TEXT[] DEFAULT ARRAY[
    'daily_objective','pending_tasks','habits',
    'inbox_unread','events_today','affirmation'
  ],
  daily_objective_prompt TEXT DEFAULT '¿Cuál es tu objetivo #1 de hoy?',
  show_affirmation BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MORNING_RITUAL_LOGS (Registro diario del ritual completado)
CREATE TABLE IF NOT EXISTS morning_ritual_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  daily_objective TEXT,
  affirmation TEXT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 5. DREAMS (Sueños y aspiraciones para OKRs)
CREATE TABLE IF NOT EXISTS dreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Personal'
    CHECK (category IN ('Personal','Professional','Health','Financial','Relationships','Adventure')),
  status TEXT DEFAULT 'Pending'
    CHECK (status IN ('Pending','InProgress','Achieved','Deferred')),
  target_year INT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BUDGET_ENVELOPES (Sobres de presupuesto por categoría)
CREATE TABLE IF NOT EXISTS budget_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- 'YYYY-MM'
  category TEXT NOT NULL,
  allocated_amount NUMERIC(12,2) DEFAULT 0,
  spent_amount NUMERIC(12,2) DEFAULT 0,
  color_hex TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'wallet',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_year, category)
);

-- ═══════════════════════════════════════════════
-- MODIFICACIONES A TABLAS EXISTENTES
-- ═══════════════════════════════════════════════

-- HABITS: agregar tiempo estimado, momento del día, orden, etc.
ALTER TABLE habits ADD COLUMN IF NOT EXISTS estimated_minutes INT DEFAULT 15;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT 'morning'
  CHECK (time_of_day IN ('morning','afternoon','evening','anytime'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'flame';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- OBJECTIVES: agregar progreso, notas, link a dreams, etc.
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS progress_pct INT DEFAULT 0;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS dream_id UUID REFERENCES dreams(id) ON DELETE SET NULL;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS priority INT DEFAULT 2;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS target_date DATE;

-- CHILD_REGISTRY: agregar campos de salud y desarrollo
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS head_circ_cm NUMERIC(5,1);
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1);
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS symptoms TEXT[];
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS milestone_type TEXT
  CHECK (milestone_type IN ('motor','language','social','cognitive',NULL));
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE child_registry ADD COLUMN IF NOT EXISTS event_date DATE;

-- TASKS: agregar fecha planificada (distinta a due_date)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INT;

-- FINANCES: agregar campo de categoría de presupuesto
ALTER TABLE finances ADD COLUMN IF NOT EXISTS budget_category TEXT;

-- ═══════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_ritual_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_ritual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_envelopes ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'events','weekly_plans','morning_ritual_config',
    'morning_ritual_logs','dreams','budget_envelopes'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %1$I_select ON %1$I;
       CREATE POLICY %1$I_select ON %1$I FOR SELECT USING (auth.uid() = user_id);
       DROP POLICY IF EXISTS %1$I_insert ON %1$I;
       CREATE POLICY %1$I_insert ON %1$I FOR INSERT WITH CHECK (auth.uid() = user_id);
       DROP POLICY IF EXISTS %1$I_update ON %1$I;
       CREATE POLICY %1$I_update ON %1$I FOR UPDATE USING (auth.uid() = user_id);
       DROP POLICY IF EXISTS %1$I_delete ON %1$I;
       CREATE POLICY %1$I_delete ON %1$I FOR DELETE USING (auth.uid() = user_id);',
      tbl
    );
  END LOOP;
END $$;
