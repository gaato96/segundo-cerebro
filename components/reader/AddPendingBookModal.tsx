'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Search, Loader2, BookMarked, Check, AlertCircle } from 'lucide-react'
import { searchBookCovers, addPendingBook, setPendingBookCover, type CoverResult } from '@/lib/actions/books'
import { cn } from '@/lib/utils'

interface Props {
    onClose: () => void
    onSaved: () => void
    /** Si viene, se cambia la tapa de un pendiente existente en vez de crear uno. */
    editing?: { id: string; title: string; author: string | null } | null
}

/**
 * Agregar un libro a "Pendientes": solo el título. Mientras escribís busca la tapa
 * en Open Library y elegís la correcta (o dejás que tome la primera).
 */
export function AddPendingBookModal({ onClose, onSaved, editing }: Props) {
    const [title, setTitle] = useState(editing?.title || '')
    const [author, setAuthor] = useState(editing?.author || '')
    const [results, setResults] = useState<CoverResult[]>([])
    const [picked, setPicked] = useState<CoverResult | null>(null)
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const reqId = useRef(0)

    useEffect(() => {
        const q = [title, author].filter(Boolean).join(' ').trim()
        if (q.length < 3) {
            setResults([])
            return
        }
        const id = ++reqId.current
        const t = setTimeout(async () => {
            setSearching(true)
            const res = await searchBookCovers(q)
            if (id !== reqId.current) return
            setSearching(false)
            if (res.ok) setResults(res.data)
        }, 450)
        return () => clearTimeout(t)
    }, [title, author])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return
        setSaving(true)
        setError('')
        const res = editing
            ? picked
                ? await setPendingBookCover(editing.id, picked.cover_url)
                : { ok: false as const, error: 'Elegí una tapa.' }
            : await addPendingBook({
                title: title.trim(),
                author: author.trim() || picked?.author || null,
                cover_url: picked?.cover_url || null
            })
        setSaving(false)
        if (!res.ok) return setError(res.error)
        onSaved()
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full sm:max-w-xl bg-popover border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto"
            >
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div>
                        <h2 className="font-heading font-bold text-lg">{editing ? 'Cambiar tapa' : 'Quiero leer…'}</h2>
                        <p className="text-xs text-muted-foreground">
                            {editing ? 'Elegí la portada correcta.' : 'Solo el título. La tapa se busca sola y el PDF lo subís cuando lo empieces.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="px-5 pb-5 space-y-4">
                    {error && (
                        <div className="flex gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                        <label className="block">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Título</span>
                            <div className="relative mt-1">
                                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    autoFocus
                                    value={title}
                                    onChange={e => { setTitle(e.target.value); setPicked(null) }}
                                    disabled={!!editing}
                                    placeholder="Hábitos atómicos"
                                    className="w-full bg-secondary/60 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-400/60 disabled:opacity-60"
                                />
                            </div>
                        </label>
                        <label className="block">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Autor</span>
                            <input
                                value={author}
                                onChange={e => { setAuthor(e.target.value); setPicked(null) }}
                                placeholder="Opcional"
                                className="mt-1 w-full bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400/60"
                            />
                        </label>
                    </div>

                    <div className="min-h-[120px]">
                        {searching && results.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" /> Buscando tapas…
                            </div>
                        ) : results.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {results.map(r => {
                                    const active = picked?.cover_url === r.cover_url
                                    return (
                                        <button
                                            type="button"
                                            key={r.cover_url}
                                            onClick={() => setPicked(active ? null : r)}
                                            className="text-left group"
                                        >
                                            <div className={cn(
                                                'relative aspect-[2/3] rounded-xl overflow-hidden border-2 bg-secondary transition-all',
                                                active ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-transparent group-hover:border-white/20'
                                            )}>
                                                <img src={r.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                                {active && (
                                                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center">
                                                        <Check className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] font-semibold mt-1.5 line-clamp-2 leading-snug">{r.title}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{[r.author, r.year].filter(Boolean).join(' · ')}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
                                <BookMarked className="w-7 h-7 text-amber-400/60" />
                                {title.trim().length >= 3 ? 'No encontré tapas. Se guarda igual, con el título.' : 'Escribí el título para buscar la tapa.'}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !title.trim() || (!!editing && !picked)}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookMarked className="w-4 h-4" />}
                        {editing ? 'Usar esta tapa' : picked ? 'Agregar a pendientes' : 'Agregar (busco la tapa sola)'}
                    </button>
                </form>
            </motion.div>
        </div>
    )
}
