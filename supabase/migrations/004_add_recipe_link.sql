-- ============================================================
-- ADD RECIPE LINK COLUMN
-- ============================================================

ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS link TEXT;
