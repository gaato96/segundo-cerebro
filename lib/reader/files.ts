/**
 * Los PDFs del lector: subida/descarga contra Supabase Storage y una copia local
 * por dispositivo en IndexedDB, para no volver a bajar el libro cada vez que se abre.
 */
import { createClient } from '@/lib/supabase/client'

export const BOOK_BUCKET = 'books'
// Máximo por archivo del plan gratis de Supabase (y el límite del bucket en la migración 020).
export const MAX_BOOK_BYTES = 50 * 1024 * 1024

export function formatBytes(bytes: number | null | undefined) {
    if (!bytes) return '0 MB'
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

// ─────────────────────────────────────────────────────────────
// Copia local (IndexedDB)
// ─────────────────────────────────────────────────────────────

const DB_NAME = 'segundo-cerebro-libros'
const STORE = 'pdfs'

interface CachedBook {
    id: string
    path: string
    blob: Blob
    savedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1)
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) {
                    req.result.createObjectStore(STORE, { keyPath: 'id' })
                }
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
        dbPromise.catch(() => { dbPromise = null })
    }
    return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    }))
}

/** El PDF guardado en este dispositivo, si corresponde a la misma ruta de Storage. */
export async function getLocalBook(id: string, path: string): Promise<Blob | null> {
    try {
        const entry = await tx<CachedBook | undefined>('readonly', s => s.get(id))
        return entry && entry.path === path ? entry.blob : null
    } catch {
        return null
    }
}

export async function saveLocalBook(id: string, path: string, blob: Blob) {
    try {
        // Que el navegador no lo borre cuando ande corto de espacio.
        await navigator.storage?.persist?.().catch(() => false)
        await tx('readwrite', s => s.put({ id, path, blob, savedAt: Date.now() } satisfies CachedBook))
    } catch (e) {
        // Sin copia local igual se puede leer: solo se vuelve a bajar la próxima vez.
        console.warn('No pude guardar el libro en este dispositivo:', e)
    }
}

export async function deleteLocalBook(id: string) {
    try {
        await tx('readwrite', s => s.delete(id))
    } catch { /* nada que limpiar */ }
}

export async function listLocalBookIds(): Promise<string[]> {
    try {
        return (await tx<IDBValidKey[]>('readonly', s => s.getAllKeys())).map(String)
    } catch {
        return []
    }
}

// ─────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────

/**
 * Sube el PDF directo del navegador a Storage (no pasa por el servidor de Next,
 * que tiene límite de 1 MB por request). Se usa XHR para poder mostrar el progreso.
 */
export async function uploadBookPdf(bookId: string, file: Blob, onProgress?: (fraction: number) => void): Promise<string> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Tu sesión expiró. Volvé a entrar.')

    // Misma ruta que arma createBook en el servidor: <user_id>/<book_id>.pdf
    const path = `${session.user.id}/${bookId}.pdf`
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BOOK_BUCKET}/${path}`

    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', url)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        xhr.setRequestHeader('Content-Type', 'application/pdf')
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.upload.onprogress = e => {
            if (e.lengthComputable) onProgress?.(e.loaded / e.total)
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve()
            let message = `Error ${xhr.status} al subir el PDF.`
            try {
                const body = JSON.parse(xhr.responseText)
                message = body.message || body.error || message
            } catch { /* respuesta no JSON */ }
            if (xhr.status === 413 || /maximum allowed size|too large/i.test(message)) {
                message = `El PDF supera el máximo permitido por Supabase (${formatBytes(MAX_BOOK_BYTES)}).`
            } else if (/bucket not found/i.test(message)) {
                message = 'Falta crear el bucket "books": corré la migración 020 en Supabase.'
            }
            reject(new Error(message))
        }
        xhr.onerror = () => reject(new Error('Se cortó la conexión mientras subía el PDF.'))
        xhr.send(file)
    })
    return path
}

/** Para deshacer una subida si después falla el registro del libro. */
export async function removeUploadedPdf(path: string) {
    await createClient().storage.from(BOOK_BUCKET).remove([path]).catch(() => null)
}

/** Baja el PDF de Storage con progreso (URL firmada + lectura en streaming). */
export async function downloadBookPdf(path: string, onProgress?: (fraction: number) => void): Promise<Blob> {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from(BOOK_BUCKET).createSignedUrl(path, 60 * 10)
    if (error || !data?.signedUrl) {
        throw new Error(error?.message?.includes('not found')
            ? 'El PDF ya no está en el servidor.'
            : `No pude obtener el PDF: ${error?.message || 'sin URL'}`)
    }

    const res = await fetch(data.signedUrl, { cache: 'no-store' })
    if (!res.ok || !res.body) throw new Error(`No pude descargar el PDF (error ${res.status}).`)

    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    const chunks: BlobPart[] = []
    let loaded = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.length
        if (total) onProgress?.(loaded / total)
    }
    return new Blob(chunks, { type: 'application/pdf' })
}
