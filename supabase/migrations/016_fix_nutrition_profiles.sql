-- Migration 016: Repair nutrition_profiles table
-- Ensure all columns exist and RLS is properly configured

-- Add any missing columns safely
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS disliked_ingredients TEXT[] DEFAULT '{}';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS custom_notes TEXT DEFAULT '';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS monthly_food_budget NUMERIC(12,2);
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Tucumán';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'San Miguel de Tucumán';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS tdee_calories INT;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS target_calories INT;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS target_protein_g INT;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS target_carbs_g INT;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS target_fat_g INT;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS water_liters NUMERIC(3,1) DEFAULT 2.0;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS supplements_recommended TEXT[] DEFAULT '{}';
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS measurement_frequency_days INT DEFAULT 7;
ALTER TABLE nutrition_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Enable RLS (idempotent)
ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any to recreate it cleanly
DROP POLICY IF EXISTS "nutrition_profiles_own" ON nutrition_profiles;
CREATE POLICY "nutrition_profiles_own" ON nutrition_profiles FOR ALL USING (auth.uid() = user_id);
