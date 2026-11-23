'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { X, Loader2, Highlighter, Check, ArrowRight } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { addBookHighlight } from '@/lib/actions/notes'
import { cn } from '@/lib/utils'

interface Props {
    bookId: string
    page: number
    doc: PDFDocumentProxy | null
    chromeClass: string
    mutedClass: string
    dividerClass: string
    onClose: () => void
}

/**
 * Resaltados: el lector dibuja el PDF en un canvas, así que el texto de la
 * página se muestra acá para seleccionarlo (o se pega/escribe la cita).
 * Cada resaltado se suma a la nota "Resaltados — <libro>" con su página.
 */
export function HighlightPanel({ bookId, page, doc, chromeClass, mutedClass, dividerClass, onClose }: Props) {
    const [pageText, setPageText] = useState<string | null>(null)
    const [quote, setQuote] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState<{ count: number; noteId: string } | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let alive = true
        setPageText(null)
        if (!doc) return
        doc.getPage(page)
            .then(p => p.getTextContent())
            .then(tc => {
                if (!alive) return
                let out = ''
                for (const item of tc.items as any[]) {
                    if (!('str' in item)) continue
                    out += item.str
                    out += item.hasEOL ? '\n' : ' '
                }
                setPageText(out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
            })
            .catch(() => alive && setPageText(''))
        return () => { alive = false }
    }, [doc, page])

    // Lo que se selecciona en el texto de la página pasa al campo de la cita.
    useEffect(() => {
        const onSel = () => {
            const sel = window.getSelection()?.toString().trim()
            if (sel && sel.length > 3) setQuote(sel)
        }
        document.addEventListener('selectionchange', onSel)
        return () => document.removeEventListener('selectionchange', onSel)
    }, [])

    async function save() {
        if (!quote.trim()) return
        setSaving(true)
        setError('')
        const res = await addBookHighlight(bookId, quote, page)
        setSaving(false)
        if (!res.ok) return setError(res.error)
        setSaved(s => ({ count: (s?.count || 0) + 1, noteId: res.data.noteId }))
        setQuote('')
        window.getSelection()?.removeAllRanges()
    }

    return (
        <motion.aside
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('absolute z-30 top-0 bottom-0 right-0 w-[360px] max-w-[92vw] border-l shadow-2xl flex flex-col', chromeClass)}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
        >
            <div className={cn('flex items-center justify-between px-4 h-14 border-b shrink-0', dividerClass)}>
                <span className="font-semibold flex items-center gap-2"><Highlighter className="w-4 h-4" /> Resaltar · pág {page}</span>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <p className={cn('text-xs', mutedClass)}>Seleccioná el pasaje en el texto de la página, o pegalo o escribilo abajo.</p>
                <div className={cn('rounded-xl border p-3 text-sm leading-relaxed whitespace-pre-wrap select-text max-h-[42vh] overflow-y-auto', dividerClass)}>
                    {pageText === null ? (
                        <span className="flex items-center gap-2 opacity-60"><Loader2 className="w-4 h-4 animate-spin" /> Leyendo la página…</span>
                    ) : pageText ? pageText : (
                        <span className={mutedClass}>Esta página no tiene texto seleccionable (es una imagen). Escribí la cita abajo.</span>
                    )}
                </div>
            </div>

            <div className={cn('border-t p-4 space-y-2.5 shrink-0', dividerClass)} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
                <textarea
                    value={quote}
                    onChange={e => setQuote(e.target.value)}
                    rows={3}
                    placeholder="La cita que querés guardar"
                    className={cn('w-full rounded-xl border bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50', dividerClass)}
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                    onClick={save}
                    disabled={saving || !quote.trim()}
                    className="w-full h-11 rounded-xl bg-amber-400 text-[#111113] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Highlighter className="w-4 h-4" />}
                    Guardar en Notas
                </button>
                {saved && (
                    <Link href={`/notas?id=${saved.noteId}`} className={cn('flex items-center justify-between text-xs', mutedClass)}>
                        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> {saved.count} {saved.count === 1 ? 'resaltado guardado' : 'resaltados guardados'}</span>
                        <span className="flex items-center gap-1">Ver la nota <ArrowRight className="w-3 h-3" /></span>
                    </Link>
                )}
            </div>
        </motion.aside>
    )
}
