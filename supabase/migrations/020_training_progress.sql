-- ===============================================
-- MIGRACION 020: EL PLAN DE ENTRENAMIENTO DEJA DE
--                AVANZAR SOLO CON EL CALENDARIO
-- ===============================================
--
-- Antes la semana actual salia de una resta de fechas: arrancaste el 1/9, hoy
-- es 22/9, entonces estabas en la semana 4 aunque no hubieras hecho una sola
-- sesion. Las semanas que no hiciste quedaban atras como si las hubieras hecho.

-- Como avanza el plan:
--   adaptive  -> la semana actual es la primera que todavia tiene dias sin
--                resolver. Si no hiciste la semana 1, seguis en la semana 1.
--   calendar  -> el comportamiento viejo, por si alguien lo prefiere.
ALTER TABLE training_plans
    ADD COLUMN IF NOT EXISTS progress_mode TEXT NOT NULL DEFAULT 'adaptive';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'training_plans_progress_mode_check'
    ) THEN
        ALTER TABLE training_plans
            ADD CONSTRAINT training_plans_progress_mode_check
            CHECK (progress_mode IN ('adaptive', 'calendar'));
    END IF;
END $$;

-- Saltear una sesion es la valvula de escape del modo adaptativo: un dia que no
-- vas a hacer nunca no te tiene que dejar trabado en esa semana para siempre.
-- Una sesion salteada resuelve el dia pero NO cuenta como completada.
ALTER TABLE training_logs
    ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT false;
