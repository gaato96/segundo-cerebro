-- Migration 013: Add mit_task_ids array to morning_ritual_logs
ALTER TABLE morning_ritual_logs
  ADD COLUMN IF NOT EXISTS mit_task_ids TEXT[] DEFAULT '{}';
