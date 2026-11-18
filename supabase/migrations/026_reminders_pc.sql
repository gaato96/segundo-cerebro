-- ===============================================
-- MIGRACION 026: RECORDATORIOS EN LA PC
--   Hora de aviso para hábitos (las tareas ya tienen reminder_time desde la 009).
--   El aviso sale en la compu a esa hora: desde la app abierta y, si está
--   configurado el cron cada 5 minutos (ver 027), también por push.
-- ===============================================

ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT NULL;

-- Por si la 009 no se hubiera corrido en algún entorno
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_fired BOOL DEFAULT FALSE;

-- Recordatorios de hábitos y tareas en el registro de avisos
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS item_reminders BOOLEAN NOT NULL DEFAULT true;
