-- ═══════════════════════════════════════════════
-- MIGRACIÓN 017: COPILOTO PERSONAL + ENTRENAMIENTO 3 MESES + COMPROMISO DIARIO
-- ═══════════════════════════════════════════════

-- ============================================================
-- 1. COPILOTO: contexto personal ("quién soy")
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    about_me TEXT DEFAULT '',            -- quién soy, historia, personalidad
    work TEXT DEFAULT '',                -- a qué me dedico, proyectos, clientes
    relationships TEXT DEFAULT '',       -- familia, pareja, hijos, amigos
    identity_statement TEXT DEFAULT '',  -- la persona que quiero ser
    current_focus TEXT DEFAULT '',       -- en qué estoy enfocado ahora
    struggles TEXT DEFAULT '',           -- qué me cuesta / patrones que repito
    boundaries TEXT DEFAULT '',          -- temas que NO quiero que toque
    tone_preference TEXT DEFAULT 'directo', -- directo | suave | duro | analitico
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. COPILOTO: conversaciones (una por "sesión" / tema)
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    persona TEXT NOT NULL DEFAULT 'terapeuta'
        CHECK (persona IN ('terapeuta','coach','amigo','socio','estratega','nutricionista')),
    title TEXT NOT NULL DEFAULT 'Nueva conversación',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    persona TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user ON assistant_sessions(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_session ON assistant_messages(session_id, created_at ASC);

-- ============================================================
-- 3. COMPROMISO DE MAÑANA (intención de implementación)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,                   -- el día PARA el que se firma el compromiso
    action TEXT NOT NULL,                 -- la única acción no negociable
    scheduled_time TIME,                  -- a qué hora exacta
    location TEXT,                        -- dónde
    two_minute_version TEXT,              -- la versión mínima imposible de fallar
    identity_why TEXT,                    -- "porque soy alguien que..."
    obstacle TEXT,                        -- qué puede salir mal
    if_then_plan TEXT,                    -- "si pasa X, entonces hago Y"
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','partial','skipped')),
    reflection TEXT,                      -- qué pasó realmente
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_commitments_user_date ON daily_commitments(user_id, date DESC);

-- ============================================================
-- 4. ENTRENAMIENTO: perfil (equipamiento, nivel, disponibilidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS training_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    level TEXT DEFAULT 'principiante' CHECK (level IN ('principiante','intermedio','avanzado')),
    goal TEXT DEFAULT 'recomposicion' CHECK (goal IN ('perder_grasa','ganar_musculo','recomposicion','resistencia','salud')),
    days_per_week INT DEFAULT 4 CHECK (days_per_week BETWEEN 2 AND 6),
    session_minutes INT DEFAULT 30,
    equipment TEXT[] DEFAULT ARRAY['peso_corporal'],  -- ver lib/trainingLibrary.ts
    location TEXT DEFAULT 'casa' CHECK (location IN ('casa','gimnasio','aire_libre','mixto')),
    include_rope BOOLEAN DEFAULT true,                 -- saltar la soga
    preferred_days INT[] DEFAULT '{1,2,4,5}',          -- ISO: 1=Lun … 7=Dom
    limitations TEXT DEFAULT '',                       -- lesiones, dolores, restricciones
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. ENTRENAMIENTO: plan completo de 3 meses (12 semanas)
-- ============================================================
CREATE TABLE IF NOT EXISTS training_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Plan 3 meses',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    goal TEXT,
    level TEXT,
    days_per_week INT,
    session_minutes INT,
    equipment TEXT[] DEFAULT '{}',
    -- { "weeks": [ { "week": 1, "block": "Adaptación", "focus": "...", "deload": false,
    --               "rope": {...}, "coach_note": "...",
    --               "days": [ { "day_iso": 1, "title": "...", "blocks": [...] } ] } ] }
    plan_data JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id, start_date DESC);

-- ============================================================
-- 6. ENTRENAMIENTO: registro de sesiones cumplidas
-- ============================================================
CREATE TABLE IF NOT EXISTS training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    day_index INT NOT NULL,               -- índice del día dentro de la semana (0-based)
    date DATE,
    completed BOOLEAN DEFAULT true,
    duration_min INT,
    rpe INT CHECK (rpe BETWEEN 1 AND 10), -- esfuerzo percibido
    rope_minutes NUMERIC(4,1),            -- minutos de soga efectivos
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, plan_id, week_number, day_index)
);

CREATE INDEX IF NOT EXISTS idx_training_logs_user ON training_logs(user_id, date DESC);

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE assistant_context   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_commitments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_logs       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'assistant_context','assistant_sessions','assistant_messages',
    'daily_commitments','training_profiles','training_plans','training_logs'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %1$I_own ON %1$I;
       CREATE POLICY %1$I_own ON %1$I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assistant_context_touch ON assistant_context;
CREATE TRIGGER assistant_context_touch BEFORE UPDATE ON assistant_context
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS daily_commitments_touch ON daily_commitments;
CREATE TRIGGER daily_commitments_touch BEFORE UPDATE ON daily_commitments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS training_profiles_touch ON training_profiles;
CREATE TRIGGER training_profiles_touch BEFORE UPDATE ON training_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS training_plans_touch ON training_plans;
CREATE TRIGGER training_plans_touch BEFORE UPDATE ON training_plans
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
