-- ============================================================
-- TASK REMINDERS: Add time-based notifications to tasks
-- ============================================================

-- Add reminder_time (TIME type for storing HH:MM)
-- This works WITH due_date: on the due_date at reminder_time, fire notification
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT NULL;

-- Add flag to track if reminder was already fired (avoid duplicates)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reminder_fired BOOL DEFAULT FALSE;

-- Index for efficient reminder queries
CREATE INDEX IF NOT EXISTS tasks_reminder_lookup 
ON tasks(user_id, due_date, reminder_time) 
WHERE reminder_time IS NOT NULL AND reminder_fired = FALSE AND status != 'Done';
