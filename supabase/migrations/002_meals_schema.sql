-- ============================================================
-- SMART MEAL PLANNER — Database Schema
-- ============================================================

-- RECIPES TABLE
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}', -- lunch, dinner, dessert, etc.
  ingredients JSONB NOT NULL DEFAULT '[]', -- [{item: "Chicken", amount: "500", unit: "g"}]
  steps TEXT,
  complexity TEXT DEFAULT 'Medium' CHECK (complexity IN ('Fast', 'Medium', 'Complex')),
  protein_type TEXT, -- Chicken, Beef, Fish, Legumes, etc.
  carb_type TEXT, -- Pasta, Rice, Potatoes, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEAL COMBINATIONS TABLE (Sugerir platos que "van bien juntos")
CREATE TABLE IF NOT EXISTS meal_combinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id_1 UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_id_2 UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_recipes CHECK (recipe_id_1 <> recipe_id_2)
);

-- WEEKLY MENUS TABLE
CREATE TABLE IF NOT EXISTS weekly_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL, -- The Monday of the week
  menu_data JSONB NOT NULL DEFAULT '{}', -- { "Monday": { "lunch": recipe_id, "dinner": recipe_id }, ... }
  shopping_list JSONB NOT NULL DEFAULT '[]', -- consolidated list of ingredients
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, start_date)
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "recipes_own" ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "meal_combinations_own" ON meal_combinations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "weekly_menus_own" ON weekly_menus FOR ALL USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON recipes(user_id);
CREATE INDEX IF NOT EXISTS weekly_menus_user_date_idx ON weekly_menus(user_id, start_date);
