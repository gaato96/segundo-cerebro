-- ============================================================
-- WISHLIST LISTS: Multiple named wishlists
-- ============================================================

-- 1. Parent table for wish lists
CREATE TABLE IF NOT EXISTS wishlist_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE wishlist_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_lists_own" ON wishlist_lists FOR ALL USING (auth.uid() = user_id);

-- 3. FK on existing wishlist table
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES wishlist_lists(id) ON DELETE CASCADE;

-- 4. Index for fast filtering
CREATE INDEX IF NOT EXISTS wishlist_list_id ON wishlist(list_id);
CREATE INDEX IF NOT EXISTS wishlist_lists_user ON wishlist_lists(user_id, position);
