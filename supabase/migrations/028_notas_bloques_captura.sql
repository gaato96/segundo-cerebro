-- ===============================================
-- MIGRACION 028: NOTAS, BLOQUES DE TIEMPO Y CAPTURA UNIVERSAL
--   1. Notas con enlaces [[ ]] (el "segundo cerebro" de verdad): lo que
--      sabés, lo que leíste, decisiones. Se enlazan entre sí y con
--      objetivos, tareas y libros por título.
--   2. Bloques de tiempo: a qué hora y cuánto dura cada tarea del foco.
--   3. De dónde vino cada captura del Inbox (teclado, voz, compartido).
-- Pegar entero en el SQL Editor de Supabase. Se puede correr dos veces.
-- ===============================================

-- 1. NOTAS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    -- 'manual' | 'inbox' | 'highlight' (resaltado del lector)
    source      TEXT NOT NULL DEFAULT 'manual',
    book_id     UUID REFERENCES books(id) ON DELETE SET NULL,
    pinned      BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_title ON notes(user_id, lower(title));
CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_own" ON notes;
CREATE POLICY "notes_own" ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. BLOQUES DE TIEMPO --------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS block_start TIME;

-- 3. ORIGEN DE LA CAPTURA -----------------------------------------------
ALTER TABLE mental_notes ADD COLUMN IF NOT EXISTS source TEXT;
