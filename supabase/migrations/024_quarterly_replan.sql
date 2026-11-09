-- ===============================================
-- MIGRACION 024: REPLANIFICACIÓN TRIMESTRAL
--   Cada 3 meses (o cuando volvés después de desconectarte) el sistema
--   te lleva por 6 pasos: volver, diagnóstico, objetivos, limpieza,
--   reflexión y plan del trimestre. Acá queda guardado cada uno.
-- ===============================================

-- ============================================================
-- 1. OBJETIVOS: el trimestre necesita año
--    "Q4" sin año es ambiguo apenas pasa diciembre.
-- ============================================================
-- Primero sin default, para que los existentes queden en NULL y se rellenen
-- con el año en que se crearon (correrla dos veces no pisa nada).
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS year INT;

UPDATE objectives
   SET year = EXTRACT(YEAR FROM created_at)::INT
 WHERE year IS NULL;

ALTER TABLE objectives ALTER COLUMN year SET DEFAULT EXTRACT(YEAR FROM now())::INT;

-- ============================================================
-- 2. REVISIONES TRIMESTRALES
-- ============================================================
CREATE TABLE IF NOT EXISTS quarterly_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    year          INT  NOT NULL,
    quarter       INT  NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'done')),
    -- Último paso al que llegaste, para retomar donde lo dejaste
    step          INT  NOT NULL DEFAULT 0,
    -- Foto de los números cuando arrancaste la revisión
    diagnosis     JSONB,
    -- { funciono, no_funciono, aprendizaje, desconexion, palabra }
    reflection    JSONB NOT NULL DEFAULT '{}',
    -- Lo que decidiste con objetivos, tareas y hábitos
    decisions     JSONB NOT NULL DEFAULT '{}',
    -- El plan que propuso la IA y lo que aceptaste
    plan          JSONB,
    applied       JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    UNIQUE (user_id, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_user ON quarterly_reviews(user_id, year DESC, quarter DESC);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE quarterly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quarterly_reviews_own ON quarterly_reviews;
CREATE POLICY quarterly_reviews_own ON quarterly_reviews FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
