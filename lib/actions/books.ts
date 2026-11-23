'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { autoLogHabit } from '@/lib/autoLinks'
import { getLocalDateStr } from '@/lib/utils'

/**
 * Lector de libros PDF.
 *
 * El PDF vive en el bucket privado "books" (<user_id>/<book_id>.pdf) y cada
 * dispositivo lo baja una sola vez a IndexedDB. Lo que se sincroniza es la
 * página: así el mismo libro se retoma donde quedó en el celu, la PC o la notebook.
 *
 * Cada libro tiene su ficha en Entretenimiento (media_backlog, tipo Book): el
 * progreso se refleja ahí como "Pág X de N" y al terminarlo queda como leído.
 */

// Mismo nombre que en lib/reader/files.ts (acá no se puede exportar: 'use server').
const BOOK_BUCKET = 'books'

export type BookStatus = 'reading' | 'finished'

export interface BookItem {
    id: string
    user_id: string
    media_id: string | null
    title: string
    author: string | null
    file_path: string | null
    file_size: number | null
    page_count: number
    current_page: number
    progress_updated_at: string
    cover: string | null
    status: BookStatus
    started_at: string
    finished_at: string | null
    created_at: string
    // Calificación de su ficha en Entretenimiento (si la tiene)
    rating: number | null
}

export interface LinkableMediaBook {
    id: string
    title: string
    author_or_studio: string | null
    status: string
    progress: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// La tapa es un JPEG chico en data URL. Más que esto es que algo salió mal.
const MAX_COVER_LENGTH = 300_000

function bookProgressLabel(page: number, total: number) {
    return `Pág ${page} de ${total}`
}

/** "Pág 120 de 340" / "Pág 120" / "120" → 120 */
function parsePage(progress: string | null | undefined): number | null {
    if (!progress) return null
    const match = progress.match(/P[aá]g\s*(\d+)/i) || progress.match(/^\s*(\d+)/)
    return match ? parseInt(match[1], 10) : null
}

async function requireUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión iniciada.')
    return { supabase, user }
}

function mapBook(row: any): BookItem {
    const { media, ...rest } = row
    return {
        ...rest,
        // Sin tapa propia (PDF sin portada) se usa la que se buscó estando en pendientes.
        cover: rest.cover || media?.cover_url || null,
        rating: media?.rating != null ? Number(media.rating) : null
    }
}

export async function getBooks(): Promise<BookItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('books')
        .select('*, media:media_backlog(rating, cover_url)')
        .eq('user_id', user.id)
        .order('progress_updated_at', { ascending: false })

    if (error) {
        console.error('Error fetching books:', error)
        return []
    }
    return (data || []).map(mapBook)
}

export async function getBook(id: string): Promise<BookItem | null> {
    if (!UUID_RE.test(id)) return null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('books')
        .select('*, media:media_backlog(rating, cover_url)')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
        console.error('Error fetching book:', error)
        return null
    }
    return data ? mapBook(data) : null
}

/**
 * Libros del tracker que todavía no tienen PDF: al subir uno se puede vincular
 * con su ficha en vez de crear un duplicado.
 */
export async function getLinkableMediaBooks(): Promise<LinkableMediaBook[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const [{ data: media }, { data: linked }] = await Promise.all([
        supabase
            .from('media_backlog')
            .select('id, title, author_or_studio, status, progress')
            .eq('user_id', user.id)
            .eq('type', 'Book')
            .in('status', ['Backlog', 'Active'])
            .order('created_at', { ascending: false }),
        supabase
            .from('books')
            .select('media_id')
            .eq('user_id', user.id)
            .not('media_id', 'is', null)
    ])

    const taken = new Set((linked || []).map(b => b.media_id))
    return (media || []).filter(m => !taken.has(m.id))
}

/** media_id → book_id, para mostrar "Abrir en el lector" desde Entretenimiento. */
export async function getReaderLinks(): Promise<Record<string, string>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {}

    const { data } = await supabase
        .from('books')
        .select('id, media_id')
        .eq('user_id', user.id)
        .not('media_id', 'is', null)
        .not('file_path', 'is', null)

    return Object.fromEntries((data || []).map(b => [b.media_id as string, b.id]))
}

/**
 * Registra un libro cuyo PDF el cliente ya subió a <user_id>/<id>.pdf.
 * Crea (o reutiliza) su ficha en Entretenimiento y la deja como "Leyendo".
 */
export async function createBook(input: {
    id: string
    title: string
    author?: string | null
    pageCount: number
    fileSize: number
    cover?: string | null
    mediaId?: string | null
}): Promise<ActionResult<{ id: string; currentPage: number }>> {
    return runAction('createBook', async () => {
        const { supabase, user } = await requireUser()

        if (!UUID_RE.test(input.id)) throw new Error('Identificador de libro inválido.')
        const title = input.title.trim()
        if (!title) throw new Error('El libro necesita un título.')
        const pageCount = Math.max(1, Math.floor(input.pageCount))
        const author = input.author?.trim() || null
        const cover = input.cover && input.cover.startsWith('data:image/') && input.cover.length < MAX_COVER_LENGTH
            ? input.cover
            : null

        let mediaId: string | null = null
        let currentPage = 1

        if (input.mediaId) {
            const { data: media, error } = await supabase
                .from('media_backlog')
                .select('id, progress, cover_url, author_or_studio')
                .eq('id', input.mediaId)
                .eq('user_id', user.id)
                .eq('type', 'Book')
                .maybeSingle()
            if (error) throw error
            if (!media) throw new Error('No encontré ese libro en Entretenimiento.')

            // Si ya venía anotando la página a mano, el lector arranca ahí.
            const tracked = parsePage(media.progress)
            if (tracked && tracked <= pageCount) currentPage = tracked

            const { error: updError } = await supabase
                .from('media_backlog')
                .update({
                    status: 'Active',
                    progress: bookProgressLabel(currentPage, pageCount),
                    cover_url: media.cover_url || cover,
                    author_or_studio: media.author_or_studio || author
                })
                .eq('id', media.id)
                .eq('user_id', user.id)
            if (updError) throw updError
            mediaId = media.id
        } else {
            const { data: media, error } = await supabase
                .from('media_backlog')
                .insert({
                    user_id: user.id,
                    type: 'Book',
                    status: 'Active',
                    title,
                    author_or_studio: author,
                    cover_url: cover,
                    progress: bookProgressLabel(1, pageCount),
                    rating: null,
                    notes: ''
                })
                .select('id')
                .single()
            if (error) throw error
            mediaId = media.id
        }

        const { error } = await supabase.from('books').insert({
            id: input.id,
            user_id: user.id,
            media_id: mediaId,
            title,
            author,
            file_path: `${user.id}/${input.id}.pdf`,
            file_size: Math.max(0, Math.floor(input.fileSize)),
            page_count: pageCount,
            current_page: currentPage,
            cover
        })
        if (error) throw error

        revalidatePath('/lectura')
        revalidatePath('/media')
        return { id: input.id, currentPage }
    })
}

/**
 * Guarda la página donde quedé. Se llama seguido (con debounce) desde el lector,
 * por eso no revalida rutas.
 */
export async function saveReadingProgress(id: string, page: number): Promise<ActionResult<{ progress_updated_at: string }>> {
    return runAction('saveReadingProgress', async () => {
        const { supabase, user } = await requireUser()
        if (!UUID_RE.test(id)) throw new Error('Libro inválido.')

        const { data: book, error: getError } = await supabase
            .from('books')
            .select('page_count, media_id, current_page')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (getError) throw getError
        if (!book) throw new Error('Ese libro ya no existe.')

        const current = Math.min(Math.max(1, Math.floor(page)), book.page_count)
        const now = new Date().toISOString()

        const { error } = await supabase
            .from('books')
            .update({ current_page: current, progress_updated_at: now })
            .eq('id', id)
            .eq('user_id', user.id)
        if (error) throw error

        if (book.media_id) {
            await supabase
                .from('media_backlog')
                .update({ progress: bookProgressLabel(current, book.page_count) })
                .eq('id', book.media_id)
                .eq('user_id', user.id)
        }

        // Avanzar páginas tilda solo el hábito de leer.
        if (current > Number(book.current_page || 0)) {
            await autoLogHabit(supabase, user.id, 'reading', getLocalDateStr())
        }

        return { progress_updated_at: now }
    })
}

/** Lo que haya guardado otro dispositivo, para ofrecer "seguir desde ahí". */
export async function getReadingProgress(id: string): Promise<ActionResult<{ current_page: number; progress_updated_at: string }>> {
    return runAction('getReadingProgress', async () => {
        const { supabase, user } = await requireUser()
        const { data, error } = await supabase
            .from('books')
            .select('current_page, progress_updated_at')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Ese libro ya no existe.')
        return data
    })
}

/** Lo archiva y lo deja como leído (con calificación) en Entretenimiento. */
export async function finishBook(id: string, rating: number | null): Promise<ActionResult<null>> {
    return runAction('finishBook', async () => {
        const { supabase, user } = await requireUser()

        const { data: book, error: getError } = await supabase
            .from('books')
            .select('page_count, media_id, title, author, cover')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (getError) throw getError
        if (!book) throw new Error('Ese libro ya no existe.')

        const now = new Date().toISOString()
        const { error } = await supabase
            .from('books')
            .update({
                status: 'finished',
                finished_at: now,
                current_page: book.page_count,
                progress_updated_at: now
            })
            .eq('id', id)
            .eq('user_id', user.id)
        if (error) throw error

        const safeRating = rating != null ? Math.min(10, Math.max(1, Math.round(rating * 10) / 10)) : null
        const mediaFields = {
            status: 'Finished',
            progress: bookProgressLabel(book.page_count, book.page_count),
            ...(safeRating != null ? { rating: safeRating } : {})
        }

        if (book.media_id) {
            const { error: mediaError } = await supabase
                .from('media_backlog')
                .update(mediaFields)
                .eq('id', book.media_id)
                .eq('user_id', user.id)
            if (mediaError) throw mediaError
        } else {
            // La ficha se borró de Entretenimiento en el medio: se vuelve a crear para que quede registrado.
            const { data: media, error: mediaError } = await supabase
                .from('media_backlog')
                .insert({
                    user_id: user.id,
                    type: 'Book',
                    title: book.title,
                    author_or_studio: book.author,
                    cover_url: book.cover,
                    notes: '',
                    ...mediaFields
                })
                .select('id')
                .single()
            if (mediaError) throw mediaError
            await supabase.from('books').update({ media_id: media.id }).eq('id', id).eq('user_id', user.id)
        }

        revalidatePath('/lectura')
        revalidatePath('/media')
        return null
    })
}

/** Volver a leerlo: sale del archivo y arranca desde la primera página. */
export async function reopenBook(id: string): Promise<ActionResult<null>> {
    return runAction('reopenBook', async () => {
        const { supabase, user } = await requireUser()

        const { data: book, error } = await supabase
            .from('books')
            .update({ status: 'reading', finished_at: null, current_page: 1, progress_updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('media_id, page_count, file_path')
            .maybeSingle()
        if (error) throw error
        if (!book) throw new Error('Ese libro ya no existe.')
        if (!book.file_path) throw new Error('El PDF de este libro se borró. Subilo de nuevo para volver a leerlo.')

        // La ficha de Entretenimiento queda como leída (con su nota); solo se actualiza el progreso.
        if (book.media_id) {
            await supabase
                .from('media_backlog')
                .update({ progress: bookProgressLabel(1, book.page_count) })
                .eq('id', book.media_id)
                .eq('user_id', user.id)
        }

        revalidatePath('/lectura')
        return null
    })
}

/** Borra el PDF de Storage para liberar espacio; el libro sigue en el archivo. */
export async function removeBookFile(id: string): Promise<ActionResult<null>> {
    return runAction('removeBookFile', async () => {
        const { supabase, user } = await requireUser()

        const { data: book, error } = await supabase
            .from('books')
            .select('file_path')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (error) throw error
        if (!book) throw new Error('Ese libro ya no existe.')

        if (book.file_path) {
            const { error: rmError } = await supabase.storage.from(BOOK_BUCKET).remove([book.file_path])
            if (rmError) throw rmError
        }

        const { error: updError } = await supabase
            .from('books')
            .update({ file_path: null })
            .eq('id', id)
            .eq('user_id', user.id)
        if (updError) throw updError

        revalidatePath('/lectura')
        revalidatePath('/media')
        return null
    })
}

/** Elimina el libro y su PDF. La ficha en Entretenimiento se conserva. */
export async function deleteBook(id: string): Promise<ActionResult<null>> {
    return runAction('deleteBook', async () => {
        const { supabase, user } = await requireUser()

        const { data: book, error } = await supabase
            .from('books')
            .select('file_path')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (error) throw error
        if (!book) return null

        if (book.file_path) {
            const { error: rmError } = await supabase.storage.from(BOOK_BUCKET).remove([book.file_path])
            if (rmError) throw rmError
        }

        const { error: delError } = await supabase.from('books').delete().eq('id', id).eq('user_id', user.id)
        if (delError) throw delError

        revalidatePath('/lectura')
        revalidatePath('/media')
        return null
    })
}

// ============================================================
// PENDIENTES: libros que quiero leer, sin PDF todavía
//
// Viven en Entretenimiento (media_backlog, tipo Book) sin un PDF vinculado.
// Se cargan solo con el título; la tapa se busca sola en Open Library.
// Cuando toca leerlo, se sube el PDF y queda vinculado a esa misma ficha.
// ============================================================

export interface PendingBook {
    id: string
    title: string
    author_or_studio: string | null
    status: string
    progress: string | null
    cover_url: string | null
    created_at: string
}

export interface CoverResult {
    title: string
    author: string | null
    year: number | null
    cover_url: string
}

export async function getPendingBooks(): Promise<PendingBook[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const [{ data: media }, { data: linked }] = await Promise.all([
        supabase
            .from('media_backlog')
            .select('id, title, author_or_studio, status, progress, cover_url, created_at')
            .eq('user_id', user.id)
            .eq('type', 'Book')
            .in('status', ['Backlog', 'Active'])
            .order('created_at', { ascending: false }),
        supabase
            .from('books')
            .select('media_id')
            .eq('user_id', user.id)
            .not('media_id', 'is', null)
    ])

    const taken = new Set((linked || []).map(b => b.media_id))
    return (media || []).filter(m => !taken.has(m.id)) as PendingBook[]
}

async function fetchJson(url: string, ms = 6000): Promise<any | null> {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(ms),
            headers: { 'User-Agent': 'SegundoCerebro/1.0 (lector personal)' },
            cache: 'no-store'
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

async function searchCovers(query: string, limit = 8): Promise<CoverResult[]> {
    const q = encodeURIComponent(query.trim())
    const ol = await fetchJson(
        `https://openlibrary.org/search.json?q=${q}&limit=${limit * 2}&fields=title,author_name,cover_i,first_publish_year`
    )
    const results: CoverResult[] = (ol?.docs || [])
        .filter((d: any) => d.cover_i)
        .slice(0, limit)
        .map((d: any) => ({
            title: d.title,
            author: d.author_name?.[0] || null,
            year: d.first_publish_year || null,
            cover_url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
        }))
    if (results.length) return results

    // Respaldo: Google Books (sin clave tiene cupo diario chico, por eso va segundo).
    const gb = await fetchJson(
        `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${limit}&fields=items(volumeInfo(title,authors,publishedDate,imageLinks))`
    )
    return (gb?.items || [])
        .map((i: any) => i.volumeInfo)
        .filter((v: any) => v?.imageLinks?.thumbnail)
        .map((v: any) => ({
            title: v.title,
            author: v.authors?.[0] || null,
            year: v.publishedDate ? parseInt(String(v.publishedDate).slice(0, 4), 10) || null : null,
            cover_url: String(v.imageLinks.thumbnail).replace('http://', 'https://').replace('&edge=curl', '')
        }))
}

/** Busca un libro por título (y autor) y devuelve opciones con tapa. */
export async function searchBookCovers(query: string): Promise<ActionResult<CoverResult[]>> {
    return runAction('searchBookCovers', async () => {
        if (!query.trim()) return []
        return searchCovers(query)
    })
}

export async function addPendingBook(input: {
    title: string
    author?: string | null
    cover_url?: string | null
}): Promise<ActionResult<{ id: string }>> {
    return runAction('addPendingBook', async () => {
        const { supabase, user } = await requireUser()
        const title = input.title.trim()
        if (!title) throw new Error('Escribí el título.')

        let cover = input.cover_url?.startsWith('https://') ? input.cover_url : null
        let author = input.author?.trim() || null
        // Si no eligió ninguna opción, se busca la tapa sola.
        if (!cover) {
            const [first] = await searchCovers(author ? `${title} ${author}` : title, 1)
            if (first) {
                cover = first.cover_url
                author = author || first.author
            }
        }

        const { data, error } = await supabase
            .from('media_backlog')
            .insert({
                user_id: user.id,
                type: 'Book',
                status: 'Backlog',
                title: title.slice(0, 200),
                author_or_studio: author,
                cover_url: cover,
                progress: 'Pág 1',
                notes: ''
            })
            .select('id')
            .single()
        if (error) throw error

        revalidatePath('/lectura')
        revalidatePath('/media')
        return { id: data.id }
    })
}

export async function setPendingBookCover(id: string, coverUrl: string): Promise<ActionResult<null>> {
    return runAction('setPendingBookCover', async () => {
        const { supabase, user } = await requireUser()
        if (!coverUrl.startsWith('https://')) throw new Error('Tapa inválida.')
        const { error } = await supabase
            .from('media_backlog')
            .update({ cover_url: coverUrl })
            .eq('id', id)
            .eq('user_id', user.id)
        if (error) throw error
        revalidatePath('/lectura')
        return null
    })
}

/** Busca tapa para los pendientes que no tienen. De a pocos, para no tardar. */
export async function fillMissingCovers(): Promise<ActionResult<{ filled: number }>> {
    return runAction('fillMissingCovers', async () => {
        const { supabase, user } = await requireUser()
        const pending = (await getPendingBooks()).filter(b => !b.cover_url).slice(0, 8)

        const found = await Promise.all(pending.map(async b => {
            const [first] = await searchCovers(b.author_or_studio ? `${b.title} ${b.author_or_studio}` : b.title, 1)
            return first ? { id: b.id, cover: first.cover_url, author: b.author_or_studio || first.author } : null
        }))

        let filled = 0
        for (const f of found) {
            if (!f) continue
            const { error } = await supabase
                .from('media_backlog')
                .update({ cover_url: f.cover, author_or_studio: f.author })
                .eq('id', f.id)
                .eq('user_id', user.id)
            if (!error) filled++
        }
        if (filled) revalidatePath('/lectura')
        return { filled }
    })
}

export async function removePendingBook(id: string): Promise<ActionResult<null>> {
    return runAction('removePendingBook', async () => {
        const { supabase, user } = await requireUser()
        const { error } = await supabase
            .from('media_backlog')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
            .eq('type', 'Book')
        if (error) throw error
        revalidatePath('/lectura')
        revalidatePath('/media')
        return null
    })
}
