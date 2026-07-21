-- ============================================================
-- UPDATE MEDIA BACKLOG RATING: Alter from INT 1-5 to NUMERIC(3,1) 1.0-10.0
-- ============================================================

-- 1. Drop existing check constraint
ALTER TABLE media_backlog 
DROP CONSTRAINT IF EXISTS media_backlog_rating_check;

-- 2. Alter column type to NUMERIC(3,1)
ALTER TABLE media_backlog 
ALTER COLUMN rating TYPE NUMERIC(3,1);

-- 3. Add new check constraint for 1.0 to 10.0
ALTER TABLE media_backlog 
ADD CONSTRAINT media_backlog_rating_check CHECK (rating >= 1.0 AND rating <= 10.0);
