-- ===============================================
-- MIGRACION 023: PLAN DE PARQUE Y REGISTRO DE PARTIDOS
--   El plan de parque (lib/parkPlan.ts) complementa al plan de fuerza
--   con aire, piques y cambios de dirección. Los partidos de la semana
--   se registran con notas simples para ver si estás mejorando o no.
-- ===============================================

-- ============================================================
-- 1. SESIONES DEL PLAN DE PARQUE
--    El plan es estático (código); acá solo vive lo que hiciste.
-- ============================================================
CREATE TABLE IF NOT EXISTS park_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_number   INT NOT NULL CHECK (week_number BETWEEN 1 AND 8),
    session_index INT NOT NULL CHECK (session_index >= 0),
    date          DATE,
    completed     BOOLEAN NOT NULL DEFAULT true,
    skipped       BOOLEAN NOT NULL DEFAULT false,
    -- Hiciste la versión mínima de 10′ (cuenta como hecha, pero se distingue)
    minimum       BOOLEAN NOT NULL DEFAULT false,
    with_julian   BOOLEAN NOT NULL DEFAULT false,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_number, session_index)
);

CREATE INDEX IF NOT EXISTS idx_park_logs_user ON park_logs(user_id, date DESC);

-- ============================================================
-- 2. PARTIDOS DE FÚTBOL
-- ============================================================
CREATE TABLE IF NOT EXISTS football_matches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    format        TEXT NOT NULL DEFAULT 'f5' CHECK (format IN ('f5', 'f7', 'f8', 'f11', 'otro')),
    minutes       INT CHECK (minutes BETWEEN 1 AND 180),
    -- Notas de 1 a 10
    overall       INT NOT NULL CHECK (overall BETWEEN 1 AND 10),  -- cómo jugué en general
    stamina       INT NOT NULL CHECK (stamina BETWEEN 1 AND 10),  -- aire / resistencia
    speed         INT CHECK (speed BETWEEN 1 AND 10),             -- piernas, piques
    touch         INT CHECK (touch BETWEEN 1 AND 10),             -- toque, coordinación
    -- Minuto en el que te fundiste (NULL = llegaste entero)
    gassed_at_min INT CHECK (gassed_at_min BETWEEN 0 AND 180),
    goals         INT NOT NULL DEFAULT 0 CHECK (goals >= 0),
    assists       INT NOT NULL DEFAULT 0 CHECK (assists >= 0),
    result        TEXT CHECK (result IN ('ganado', 'empatado', 'perdido')),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_football_matches_user ON football_matches(user_id, date DESC);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE park_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS park_logs_own ON park_logs;
CREATE POLICY park_logs_own ON park_logs FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS football_matches_own ON football_matches;
CREATE POLICY football_matches_own ON football_matches FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
