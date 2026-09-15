-- ===============================================
-- MIGRACION 019: BANCO DE IDEAS + DEUDAS CON INTERES Y PLANES DE PAGO
--                + FUENTES DE INGRESO + HABITOS X VECES POR SEMANA
--                + OKRs SMART + CORTE DEL DIA (cierre despues de medianoche)
-- ===============================================

-- ============================================================
-- 1. CORTE DEL DIA
--    El dia "logico" no termina a las 00:00: termina a la hora en
--    que el usuario se va a dormir. Con esto, hacer el cierre a la
--    01:30 sigue cerrando el dia anterior.
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS day_cutoff_hour INT NOT NULL DEFAULT 4
    CHECK (day_cutoff_hour BETWEEN 0 AND 12);

-- ============================================================
-- 2. BANCO DE IDEAS
--    Antes, procesar una captura como "nota"/"archivo" la sacaba del
--    inbox y no la mostraba en ningun lado. Ahora tiene casa propia.
-- ============================================================
CREATE TABLE IF NOT EXISTS idea_bank (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT,
    category        TEXT DEFAULT 'General',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'raw'
                      CHECK (status IN ('raw', 'exploring', 'promoted', 'archived')),
    -- 1 a 5: para poder ordenar el banco por lo que mas mueve la aguja
    impact          INT CHECK (impact BETWEEN 1 AND 5),
    effort          INT CHECK (effort BETWEEN 1 AND 5),
    source          TEXT DEFAULT 'manual',   -- 'inbox' | 'manual' | 'ia'
    source_note_id  UUID REFERENCES mental_notes(id) ON DELETE SET NULL,
    promoted_to     TEXT,                    -- 'task' | 'objective'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idea_bank_user_status
  ON idea_bank(user_id, status, created_at DESC);

-- Rescate: las capturas ya procesadas como "nota" nunca se borraron,
-- solo quedaron invisibles. Se mudan al banco de ideas.
INSERT INTO idea_bank (user_id, title, content, source, source_note_id, created_at, status)
SELECT
    mn.user_id,
    LEFT(REGEXP_REPLACE(mn.content, E'\\s+', ' ', 'g'), 80),
    mn.content,
    'inbox',
    mn.id,
    mn.created_at,
    'raw'
FROM mental_notes mn
WHERE mn.is_processed = true
  AND mn.processed_as = 'note'
  AND NOT EXISTS (SELECT 1 FROM idea_bank ib WHERE ib.source_note_id = mn.id);

-- ============================================================
-- 3. DEUDAS: INTERES REAL, PLANES DE PAGO Y OBSERVACIONES
-- ============================================================
ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'otro'
    CHECK (kind IN ('tarjeta', 'prestamo', 'particular', 'servicio', 'impuesto', 'otro')),
  -- El interes se declara con su periodo: 'daily' es el caso feo (punitorios).
  ADD COLUMN IF NOT EXISTS interest_type TEXT NOT NULL DEFAULT 'none'
    CHECK (interest_type IN ('none', 'daily', 'monthly', 'annual')),
  -- NUMERIC(5,2) no alcanzaba para una tasa diaria (ej: 0.2534% por dia).
  ADD COLUMN IF NOT EXISTS interest_rate_pct NUMERIC(10, 6) DEFAULT 0,
  -- Cuando el usuario NO sabe la tasa: el sistema la estima con observaciones.
  ADD COLUMN IF NOT EXISTS interest_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_daily_rate_pct NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS interest_capitalizes BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'in_plan', 'paid', 'frozen')),
  -- Plan de pago: "la financie en N cuotas"
  ADD COLUMN IF NOT EXISTS plan_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_installments INT,
  ADD COLUMN IF NOT EXISTS plan_installment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS plan_installments_paid INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_first_due_date DATE,
  ADD COLUMN IF NOT EXISTS plan_due_day INT CHECK (plan_due_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS plan_total_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS plan_notes TEXT,
  ADD COLUMN IF NOT EXISTS opened_on DATE DEFAULT CURRENT_DATE;

-- La tasa vieja (interest_rate, mensual por convencion) se migra una sola vez.
UPDATE debts
SET interest_rate_pct = interest_rate,
    interest_type = 'monthly'
WHERE interest_rate IS NOT NULL
  AND interest_rate > 0
  AND interest_type = 'none'
  AND COALESCE(interest_rate_pct, 0) = 0;

-- Observaciones: "el 12/09 me dijeron que debo $X".
-- Con dos observaciones se deduce la tasa diaria implicita.
CREATE TABLE IF NOT EXISTS debt_observations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    debt_id         UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    observed_on     DATE NOT NULL,
    observed_amount NUMERIC(12, 2) NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(debt_id, observed_on)
);

CREATE INDEX IF NOT EXISTS idx_debt_observations_debt
  ON debt_observations(debt_id, observed_on DESC);

-- ============================================================
-- 4. FUENTES DE INGRESO
--    Un sueldo fijo que no alcanza + trabajos que pueden salir o no
--    + cobros en 2/3/4 pagos + recurrentes. Cada uno se modela distinto.
-- ============================================================
CREATE TABLE IF NOT EXISTS income_sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    kind                TEXT NOT NULL DEFAULT 'fixed'
                          CHECK (kind IN ('fixed', 'variable', 'installments', 'recurring')),
    amount              NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- monto por cobro
    client              TEXT,
    -- Que tan seguro es que entre: cambia como lo usa el planificador.
    confidence          TEXT NOT NULL DEFAULT 'confirmada'
                          CHECK (confidence IN ('confirmada', 'probable', 'incierta')),
    expected_day        INT CHECK (expected_day BETWEEN 1 AND 31),
    -- installments: total de pagos y cuantos ya cobro
    installments_total  INT,
    installments_paid   INT NOT NULL DEFAULT 0,
    -- recurring: cada cuantos meses vuelve (1 = mensual)
    frequency_months    INT NOT NULL DEFAULT 1,
    start_date          DATE DEFAULT CURRENT_DATE,
    end_date            DATE,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_sources_user ON income_sources(user_id, is_active);

-- Un movimiento de ingreso puede venir de una fuente concreta.
ALTER TABLE finances
  ADD COLUMN IF NOT EXISTS income_source_id UUID REFERENCES income_sources(id) ON DELETE SET NULL;

-- ============================================================
-- 5. PLANES DE ASIGNACION DE INGRESO
--    "Me entraron $X, a que lo destino." Queda guardado para poder
--    mirar despues si se cumplio.
-- ============================================================
CREATE TABLE IF NOT EXISTS income_allocations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    amount        NUMERIC(12, 2) NOT NULL,
    source_label  TEXT,
    -- [{ target_type, target_id, label, amount, reason }]
    plan_json     JSONB NOT NULL DEFAULT '[]',
    rationale     TEXT,
    applied       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_allocations_user ON income_allocations(user_id, date DESC);

-- ============================================================
-- 6. HABITOS: X VECES POR SEMANA
-- ============================================================
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS frequency_times_per_week INT NOT NULL DEFAULT 3;

-- ============================================================
-- 7. OKRs: metodo SMART
-- ============================================================
ALTER TABLE objectives
  -- [{ title, metric, target, current, unit }]
  ADD COLUMN IF NOT EXISTS key_results JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS smart_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 8. RLS
-- ============================================================
ALTER TABLE idea_bank          ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_observations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_allocations ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'idea_bank','debt_observations','income_sources','income_allocations'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %1$I_own ON %1$I; CREATE POLICY %1$I_own ON %1$I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      tbl
    );
  END LOOP;
END $policies$;

-- ============================================================
-- 9. Triggers updated_at
-- ============================================================
DROP TRIGGER IF EXISTS idea_bank_touch ON idea_bank;
CREATE TRIGGER idea_bank_touch BEFORE UPDATE ON idea_bank
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS income_sources_touch ON income_sources;
CREATE TRIGGER income_sources_touch BEFORE UPDATE ON income_sources
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
