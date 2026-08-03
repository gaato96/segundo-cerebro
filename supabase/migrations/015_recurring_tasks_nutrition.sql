-- ═══════════════════════════════════════════════
-- MIGRACIÓN 015: TAREAS RECURRENTES + NUTRICIÓN
-- ═══════════════════════════════════════════════

-- ============================================================
-- 1. TAREAS RECURRENTES: Agregar columnas de recurrencia
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_type TEXT 
    CHECK (recurrence_type IN ('daily','weekly','biweekly','monthly','quarterly','custom'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_days INT[] DEFAULT '{}'; 
    -- días de la semana: 1=Lunes ... 7=Domingo
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_interval INT DEFAULT 1;
    -- cada N (semanas/meses según recurrence_type)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
    -- referencia a la tarea "plantilla" que generó esta instancia
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_occurrence_date DATE;
    -- próxima fecha en que debe generarse la instancia

-- Campo energy_level (ya usado en el código, asegurar que existe)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'Deep Work';

-- Índices para recurrencia
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(user_id, is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_parent ON tasks(recurring_parent_id) WHERE recurring_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_next_occurrence ON tasks(next_occurrence_date) WHERE is_recurring = true;

-- ============================================================
-- 2. NUTRICIÓN: Perfil del usuario
-- ============================================================

CREATE TABLE IF NOT EXISTS nutrition_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    weight_kg NUMERIC(5,1),
    height_cm NUMERIC(5,1),
    age INT,
    sex TEXT CHECK (sex IN ('male','female')),
    activity_level TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
    goal TEXT CHECK (goal IN ('lose_weight','maintain','gain_muscle')),
    dietary_restrictions TEXT[] DEFAULT '{}',
    disliked_ingredients TEXT[] DEFAULT '{}',
    monthly_food_budget NUMERIC(12,2),
    province TEXT DEFAULT 'Tucumán',
    city TEXT DEFAULT 'San Miguel de Tucumán',
    -- Valores calculados por la IA
    tdee_calories INT,
    target_calories INT,
    target_protein_g INT,
    target_carbs_g INT,
    target_fat_g INT,
    water_liters NUMERIC(3,1) DEFAULT 2.0,
    supplements_recommended TEXT[] DEFAULT '{}',
    measurement_frequency_days INT DEFAULT 7, -- cada cuántos días medir progreso
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_profiles_own" ON nutrition_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 3. NUTRICIÓN: Planes mensuales
-- ============================================================

CREATE TABLE IF NOT EXISTS nutrition_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- 'YYYY-MM'
    target_calories INT,
    target_protein_g INT,
    target_carbs_g INT,
    target_fat_g INT,
    -- Plan completo como JSON: { "days": [ { "date": "...", "meals": { "desayuno": {...}, "almuerzo": {...}, ... }, "approved": true } ] }
    plan_data JSONB NOT NULL DEFAULT '{}',
    -- Rutina de ejercicio semanal: { "routines": [ { "day": "Lunes", "exercises": [...] } ] }
    exercise_plan JSONB DEFAULT '{}',
    supplements TEXT[] DEFAULT '{}',
    water_liters NUMERIC(3,1) DEFAULT 2.0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused','draft')),
    -- Evaluación de fin de mes por la IA
    ai_evaluation JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, month)
);

ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_plans_own" ON nutrition_plans FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 4. NUTRICIÓN: Registro de progreso
-- ============================================================

CREATE TABLE IF NOT EXISTS nutrition_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5,1),
    waist_cm NUMERIC(5,1),
    hip_cm NUMERIC(5,1),
    arm_cm NUMERIC(5,1),
    chest_cm NUMERIC(5,1),
    body_fat_pct NUMERIC(4,1),
    feeling TEXT CHECK (feeling IN ('great','good','ok','bad','terrible')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

ALTER TABLE nutrition_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_progress_own" ON nutrition_progress FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 5. NUTRICIÓN: Historial de chat con nutricionista IA
-- ============================================================

CREATE TABLE IF NOT EXISTS nutrition_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nutrition_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_conversations_own" ON nutrition_conversations FOR ALL USING (auth.uid() = user_id);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_nutrition_progress_user_date ON nutrition_progress(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_month ON nutrition_plans(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_conversations_user ON nutrition_conversations(user_id, created_at DESC);

-- Trigger para updated_at en nutrition_profiles
CREATE OR REPLACE FUNCTION update_nutrition_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_profiles_updated_at ON nutrition_profiles;
CREATE TRIGGER nutrition_profiles_updated_at 
    BEFORE UPDATE ON nutrition_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_nutrition_profiles_updated_at();

-- Trigger para updated_at en nutrition_plans
CREATE OR REPLACE FUNCTION update_nutrition_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_plans_updated_at ON nutrition_plans;
CREATE TRIGGER nutrition_plans_updated_at 
    BEFORE UPDATE ON nutrition_plans 
    FOR EACH ROW EXECUTE FUNCTION update_nutrition_plans_updated_at();
