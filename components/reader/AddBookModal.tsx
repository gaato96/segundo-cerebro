'use client'

import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FileUp, Loader2, BookOpen, Link2, AlertCircle } from 'lucide-react'
import { createBook, type LinkableMediaBook } from '@/lib/actions/books'
import { openPdf, readPdfInfo, renderCover } from '@/lib/reader/pdf'
import {
    MAX_BOOK_BYTES, formatBytes, uploadBookPdf, removeUploadedPdf, saveLocalBook
} from '@/lib/reader/files'
import { cn } from '@/lib/utils'

interface Props {
    linkable: LinkableMediaBook[]
    onClose: () => void
    onAdded: (bookId: string) => void
}

interface Draft {
    file: File
    pageCount: number
    cover: string | null
    title: string
    author: string
    mediaId: string // '' = crear ficha nueva
}

const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** crypto.randomUUID solo existe en https/localhost; al probar por la IP de la red local no está. */
function newUuid(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const b = crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** "Pág 120 de 340" / "Pág 120" / "120" → 120 */
function parseTrackedPage(progress: string | null | undefined): number | null {
    const match = progress?.match(/P[aá]g\s*(\d+)/i) || progress?.match(/^\s*(\d+)/)
    return match ? parseInt(match[1], 10) : null
}

function titleFromFilename(name: string) {
    return name
        .replace(/\.pdf$/i, '')
        .replace(/[_]+/g, ' ')
        .replace(/\s*-\s*/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function AddBookModal({ linkable, onClose, onAdded }: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [stage, setStage] = useState<'pick' | 'reading' | 'details' | 'uploading'>('pick')
    const [draft, setDraft] = useState<Draft | null>(null)
    const [error, setError] = useState('')
    const [progress, setProgress] = useState(0)
    const [dragOver, setDragOver] = useState(false)

    async function handleFile(file: File | undefined) {
        if (!file) return
        setError('')
        if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setError('Solo PDFs por ahora.')
            return
        }
        if (file.size > MAX_BOOK_BYTES) {
            setError(`Pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(MAX_BOOK_BYTES)}. Probá comprimirlo (por ejemplo con ilovepdf.com) y subilo de nuevo.`)
            return
        }

        setStage('reading')
        try {
            const doc = await openPdf(new Uint8Array(await file.arrayBuffer()))
            const [info, cover] = await Promise.all([readPdfInfo(doc), renderCover(doc)])
            const pageCount = doc.numPages
            doc.loadingTask.destroy()

            const title = info.title || titleFromFilename(file.name)
            // Si ya está en el tracker con un título parecido, se sugiere vincularlo.
            const nTitle = normalize(title)
            const match = linkable.find(m => {
                const n = normalize(m.title)
                return n.length > 2 && (nTitle.includes(n) || n.includes(nTitle))
            })

            setDraft({
                file,
                pageCount,
                cover,
                title: match?.title || title,
                author: info.author || match?.author_or_studio || '',
                mediaId: match?.id || ''
            })
            setStage('details')
        } catch (e: any) {
            setError(e?.message || 'No pude leer el PDF.')
            setStage('pick')
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!draft || !draft.title.trim()) return
        setError('')
        setStage('uploading')
        setProgress(0)

        const id = newUuid()
        let path: string | null = null
        try {
            path = await uploadBookPdf(id, draft.file, setProgress)
            const res = await createBook({
                id,
                title: draft.title,
                author: draft.author || null,
                pageCount: draft.pageCount,
                fileSize: draft.file.size,
                cover: draft.cover,
                mediaId: draft.mediaId || null
            })
            if (!res.ok) throw new Error(res.error)
            // Este dispositivo ya lo tiene: no hace falta volver a bajarlo.
            await saveLocalBook(id, path, draft.file)
            onAdded(id)
        } catch (err: any) {
            if (path) await removeUploadedPdf(path)
            setError(err?.message || 'No pude guardar el libro.')
            setStage('details')
        }
    }

    const linkedMedia = useMemo(
        () => linkable.find(m => m.id === draft?.mediaId) || null,
        [linkable, draft?.mediaId]
    )
    // Misma regla que createBook: si ya venía anotando la página, el lector arranca ahí.
    const trackedPage = parseTrackedPage(linkedMedia?.progress)

    const busy = stage === 'reading' || stage === 'uploading'

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full sm:max-w-lg bg-[#141625] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto"
            >
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div>
                        <h2 className="font-heading font-bold text-lg">Agregar libro</h2>
                        <p className="text-xs text-muted-foreground">Se guarda en tu cuenta y lo abrís desde cualquier dispositivo.</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={stage === 'uploading'}
                        className="p-2 rounded-full hover:bg-white/10 disabled:opacity-40"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 pb-5 space-y-4">
                    {error && (
                        <div className="flex gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {(stage === 'pick' || stage === 'reading') && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => inputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => {
                                e.preventDefault()
                                setDragOver(false)
                                handleFile(e.dataTransfer.files?.[0])
                            }}
                            className={cn(
                                'w-full rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-3 text-center transition-colors',
                                dragOver ? 'border-amber-400 bg-amber-500/10' : 'border-white/15 hover:border-amber-400/60 hover:bg-white/5'
                            )}
                        >
                            {stage === 'reading' ? (
                                <>
                                    <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Leyendo el PDF…</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                                        <FileUp className="w-7 h-7 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Elegí un PDF</p>
                                        <p className="text-xs text-muted-foreground mt-1">o arrastralo acá · hasta {formatBytes(MAX_BOOK_BYTES)}</p>
                                    </div>
                                </>
                            )}
                        </button>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={e => {
                            handleFile(e.target.files?.[0])
                            e.target.value = ''
                        }}
                    />

                    {draft && (stage === 'details' || stage === 'uploading') && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-4">
                                {draft.cover ? (
                                    <img src={draft.cover} alt="" className="w-24 aspect-[2/3] object-cover rounded-xl border border-white/10 shadow-lg shrink-0" />
                                ) : (
                                    <div className="w-24 aspect-[2/3] rounded-xl bg-secondary flex items-center justify-center shrink-0">
                                        <BookOpen className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 space-y-3">
                                    <label className="block">
                                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Título</span>
                                        <input
                                            value={draft.title}
                                            onChange={e => setDraft({ ...draft, title: e.target.value })}
                                            disabled={busy}
                                            required
                                            className="mt-1 w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400/60"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Autor</span>
                                        <input
                                            value={draft.author}
                                            onChange={e => setDraft({ ...draft, author: e.target.value })}
                                            disabled={busy}
                                            placeholder="Opcional"
                                            className="mt-1 w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400/60"
                                        />
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                        {draft.pageCount} páginas · {formatBytes(draft.file.size)}
                                    </p>
                                </div>
                            </div>

                            <label className="block">
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <Link2 className="w-3.5 h-3.5" /> En Entretenimiento
                                </span>
                                <select
                                    value={draft.mediaId}
                                    onChange={e => setDraft({ ...draft, mediaId: e.target.value })}
                                    disabled={busy}
                                    className="mt-1 w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400/60"
                                >
                                    <option value="">Crear ficha nueva como "Leyendo"</option>
                                    {linkable.map(m => (
                                        <option key={m.id} value={m.id}>
                                            Usar "{m.title}" ({m.status === 'Active' ? 'leyendo' : 'pendiente'})
                                        </option>
                                    ))}
                                </select>
                                {trackedPage != null && trackedPage > 1 && trackedPage <= draft.pageCount && (
                                    <span className="block text-[11px] text-amber-300/80 mt-1">
                                        Ya ibas por la pág {trackedPage}: el lector arranca ahí.
                                    </span>
                                )}
                            </label>

                            {stage === 'uploading' && (
                                <div className="space-y-1.5">
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-200"
                                            style={{ width: `${Math.round(progress * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        {progress < 1 ? `Subiendo… ${Math.round(progress * 100)}%` : 'Guardando en tu biblioteca…'}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setDraft(null); setStage('pick') }}
                                    disabled={busy}
                                    className="px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-white/5 disabled:opacity-40"
                                >
                                    Otro archivo
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy || !draft.title.trim()}
                                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {stage === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                    {stage === 'uploading' ? 'Subiendo' : 'Guardar y leer'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
