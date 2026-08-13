-- ═══════════════════════════════════════════════
-- MIGRACIÓN 016: FIX TAREAS RECURRENTES (MISSED STATUS)
-- ═══════════════════════════════════════════════

-- 1. Actualizar restricción de CHECK status en tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status IN ('Todo', 'InProgress', 'Done', 'Missed', 'Cancelled'));

-- 2. Índice para acelerar la sincronización de tareas recurrentes
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_sync 
    ON tasks(user_id, is_recurring, status) 
    WHERE is_recurring = true OR recurring_parent_id IS NOT NULL;
