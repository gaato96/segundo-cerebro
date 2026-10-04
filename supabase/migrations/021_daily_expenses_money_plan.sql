-- ===============================================
-- MIGRACION 021: REGISTRO DIARIO DE GASTOS + PLAN DE LA PLATA
-- ===============================================
--
-- Hasta ahora un movimiento sabia de que MES era, pero no de que DIA. Sin el
-- dia no se puede saber cuanto gastas por dia, que dia de la semana se te va
-- la plata ni cuales son los gastos hormiga.

-- ============================================================
-- 1. FINANCES: fecha, medio de pago y "¿era necesario?"
-- ============================================================
ALTER TABLE finances
  -- El dia en que se gasto (o se cobro). Puede ser distinto del dia en que se cargo.
  ADD COLUMN IF NOT EXISTS occurred_on DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  -- necesario | gusto | impulso: la base para saber donde recortar.
  ADD COLUMN IF NOT EXISTS necessity TEXT;

-- Los movimientos viejos toman el dia en que se cargaron (hora argentina).
UPDATE finances
SET occurred_on = (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
WHERE occurred_on IS NULL;

ALTER TABLE finances
  ALTER COLUMN occurred_on SET DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finances_payment_method_check') THEN
        ALTER TABLE finances
            ADD CONSTRAINT finances_payment_method_check
            CHECK (payment_method IS NULL OR payment_method IN ('efectivo', 'debito', 'credito', 'transferencia', 'billetera'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finances_necessity_check') THEN
        ALTER TABLE finances
            ADD CONSTRAINT finances_necessity_check
            CHECK (necessity IS NULL OR necessity IN ('necesario', 'gusto', 'impulso'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS finances_user_occurred_on ON finances(user_id, occurred_on DESC);

-- ============================================================
-- 2. PLAN DE LA PLATA
--    Como se reparte el ingreso (porcentajes por destino), cuanto hay
--    ahorrado/invertido y el ultimo analisis de la IA para no pedirlo
--    cada vez que se abre la pantalla.
-- ============================================================
CREATE TABLE IF NOT EXISTS money_plan (
    user_id                    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    monthly_income             NUMERIC(12, 2),
    -- [{ id, pct }]  ids: necesidades | deudas | colchon | inversion | gustos
    buckets                    JSONB NOT NULL DEFAULT '[]',
    risk_profile               TEXT NOT NULL DEFAULT 'conservador'
                                 CHECK (risk_profile IN ('conservador', 'moderado', 'agresivo')),
    emergency_fund_current     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    invested_current           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    daily_spend_target         NUMERIC(12, 2),
    last_spending_analysis     JSONB,
    last_spending_analysis_at  TIMESTAMPTZ,
    last_investment_advice     JSONB,
    last_investment_advice_at  TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE money_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_plan_own ON money_plan;
CREATE POLICY money_plan_own ON money_plan
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS money_plan_touch ON money_plan;
CREATE TRIGGER money_plan_touch BEFORE UPDATE ON money_plan
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
