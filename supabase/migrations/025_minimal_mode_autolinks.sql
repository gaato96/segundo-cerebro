-- ===============================================
-- MIGRACION 025: MODO MÍNIMO, CAPTURA ÚNICA Y REGISTROS AUTOMÁTICOS
--   1. Modo mínimo: el dashboard muestra solo lo obligatorio del día.
--   2. Las notas adhesivas pasan al Inbox (un solo lugar para capturar).
--   3. Hábitos que se tildan solos cuando registrás algo relacionado.
--   4. Aviso push para volver después de días sin registrar.
-- ===============================================

-- ============================================================
-- 1. MODO MÍNIMO (prendido por defecto)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minimal_mode BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 2. NOTAS ADHESIVAS → INBOX
--    Se copian como capturas sin procesar. La tabla vieja queda intacta.
-- ============================================================
INSERT INTO mental_notes (user_id, content, is_processed, created_at, updated_at)
SELECT s.user_id, trim(s.content), false, s.created_at, now()
  FROM sticky_notes s
 WHERE trim(coalesce(s.content, '')) <> ''
   AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.user_id)
   AND NOT EXISTS (
       SELECT 1 FROM mental_notes m
        WHERE m.user_id = s.user_id AND m.content = trim(s.content)
   );

-- ============================================================
-- 3. HÁBITOS AUTOMÁTICOS
--    training: se tilda al registrar sesión de fuerza, de parque o un partido
--    reading:  se tilda al avanzar páginas en la Biblioteca
--    weight:   se tilda al registrar el peso
-- ============================================================
ALTER TABLE habits ADD COLUMN IF NOT EXISTS auto_source TEXT
    CHECK (auto_source IN ('training', 'reading', 'weight'));

-- Enganche inicial por nombre (después se cambia desde Hábitos)
UPDATE habits SET auto_source = 'training'
 WHERE auto_source IS NULL AND (title ILIKE '%entren%' OR title ILIKE '%gym%' OR title ILIKE '%ejercicio%');
UPDATE habits SET auto_source = 'reading'
 WHERE auto_source IS NULL AND (title ILIKE '%leer%' OR title ILIKE '%lectura%' OR title ILIKE '%página%' OR title ILIKE '%pagina%');
UPDATE habits SET auto_source = 'weight'
 WHERE auto_source IS NULL AND (title ILIKE '%pesar%' OR title ILIKE '%peso%');

-- Marca de que el registro lo hizo el sistema (para no duplicar ni confundir)
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS auto BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 4. AVISO DE REGRESO
-- ============================================================
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS return_nudge BOOLEAN NOT NULL DEFAULT true;
