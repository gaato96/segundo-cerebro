-- ===============================================
-- MIGRACION 022: LECTOR DE LIBROS PDF
--   Biblioteca con los PDFs que estoy leyendo, la página donde quedé
--   (sincronizada entre celular, PC y notebook) y el vínculo con el
--   tracker de Entretenimiento (media_backlog) para que al terminar
--   quede registrado como leído.
-- ===============================================

-- ============================================================
-- 1. TABLA DE LIBROS
-- ============================================================
CREATE TABLE IF NOT EXISTS books (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Su ficha en Entretenimiento. Si se borra de ahí, el libro sigue en la biblioteca.
    media_id            UUID REFERENCES media_backlog(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    author              TEXT,
    -- Ruta dentro del bucket "books": <user_id>/<book_id>.pdf
    -- NULL = el PDF se borró para liberar espacio (el registro queda).
    file_path           TEXT,
    file_size           BIGINT,
    page_count          INT NOT NULL DEFAULT 1 CHECK (page_count >= 1),
    current_page        INT NOT NULL DEFAULT 1 CHECK (current_page >= 1),
    progress_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Miniatura de la tapa (data URL JPEG chiquito, ~15 KB)
    cover               TEXT,
    status              TEXT NOT NULL DEFAULT 'reading'
                          CHECK (status IN ('reading', 'finished')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_user_status
  ON books(user_id, status, progress_updated_at DESC);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "books_own" ON books;
CREATE POLICY "books_own" ON books FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. BUCKET PRIVADO PARA LOS PDFs
--    50 MB es el máximo por archivo del plan gratis de Supabase.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('books', 'books', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Cada usuario solo ve y toca su carpeta (<user_id>/...)
DROP POLICY IF EXISTS "books_files_select" ON storage.objects;
CREATE POLICY "books_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "books_files_insert" ON storage.objects;
CREATE POLICY "books_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "books_files_update" ON storage.objects;
CREATE POLICY "books_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "books_files_delete" ON storage.objects;
CREATE POLICY "books_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);
