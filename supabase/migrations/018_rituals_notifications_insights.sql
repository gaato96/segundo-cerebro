-- ===============================================
-- MIGRACION 018: RITUAL NOCTURNO + NOTIFICACIONES PUSH
--                + REVISION SEMANAL + INBOX CON IA
-- ===============================================

-- ============================================================
-- 1. RITUAL NOCTURNO (cierre del dia)
-- ============================================================
CREATE TABLE IF NOT EXISTS evening_ritual_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_rating INT CHECK (day_rating BETWEEN 1 AND 5),
    win TEXT,                       -- la victoria del dia (se espeja a daily_wins)
    gratitude TEXT,
    brain_dump TEXT,                -- lo que quedo dando vueltas
    tomorrow_committed BOOLEAN DEFAULT false,
    inbox_cleared BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_evening_ritual_user_date ON evening_ritual_logs(user_id, date DESC);

-- ============================================================
-- 2. NOTIFICACIONES PUSH (Web Push / PWA)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN DEFAULT true,
    -- Recordatorio a la hora exacta que firmaste el compromiso
    commitment_reminder BOOLEAN DEFAULT true,
    -- Briefing de la manana
    morning_briefing BOOLEAN DEFAULT true,
    morning_time TIME DEFAULT '07:00',
    -- Empujon para hacer el ritual nocturno y firmar el de manana
    evening_ritual BOOLEAN DEFAULT true,
    evening_time TIME DEFAULT '21:30',
    -- Aviso de entrenamiento los dias que toca
    training_reminder BOOLEAN DEFAULT true,
    -- Aviso si hay tareas vencidas
    overdue_tasks BOOLEAN DEFAULT true,
    -- Revision semanal (domingos)
    weekly_review BOOLEAN DEFAULT true,
    weekly_review_time TIME DEFAULT '19:00',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Evita mandar dos veces la misma notificacion el mismo dia
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,             -- commitment | morning | evening | training | overdue | weekly_review
    ref_date DATE NOT NULL,
    ref_id TEXT DEFAULT '',         -- id opcional del objeto que motivo el aviso
    title TEXT,
    body TEXT,
    delivered INT DEFAULT 0,        -- a cuantos dispositivos llego
    sent_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, kind, ref_date, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, sent_at DESC);

-- ============================================================
-- 3. REVISION SEMANAL (se guarda sobre weekly_plans)
-- ============================================================
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS ai_review JSONB;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ============================================================
-- 4. INBOX: rastro de como se proceso cada captura
-- ============================================================
ALTER TABLE mental_notes ADD COLUMN IF NOT EXISTS processed_as TEXT;   -- task | journal | event | note | discarded
ALTER TABLE mental_notes ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE evening_ritual_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'evening_ritual_logs','push_subscriptions','notification_prefs','notification_log'
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
-- 6. Triggers updated_at
-- ============================================================
DROP TRIGGER IF EXISTS notification_prefs_touch ON notification_prefs;
CREATE TRIGGER notification_prefs_touch BEFORE UPDATE ON notification_prefs
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
