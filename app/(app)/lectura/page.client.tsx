'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    LibraryBig, Plus, BookOpen, Trophy, MoreVertical, Trash2, RotateCcw,
    HardDriveDownload, CloudOff, Star, CheckCircle2, Loader2, Smartphone, BookMarked, FileUp, ImageIcon
} from 'lucide-react'
import {
    type BookItem, type LinkableMediaBook, type PendingBook,
    finishBook, reopenBook, removeBookFile, deleteBook, removePendingBook, fillMissingCovers
} from '@/lib/actions/books'
import { AddPendingBookModal } from '@/components/reader/AddPendingBookModal'
import { listLocalBookIds, deleteLocalBook, formatBytes } from '@/lib/reader/files'
import { AddBookModal } from '@/components/reader/AddBookModal'
import { RatingModal } from '@/components/media/RatingModal'
import type { ActionResult } from '@/lib/actionResult'
import { cn } from '@/lib/utils'

interface Props {
    books: BookItem[]
    linkable: LinkableMediaBook[]
    pending: PendingBook[]
    initialTab: Tab
}

type Tab = 'pendientes' | 'leyendo' | 'leidos'

export function LibraryClient({ books, linkable, pending, initialTab }: Props) {
    const router = useRouter()
    const [tab, setTab] = useState(initialTab)
    const [adding, setAdding] = useState(false)
    const [localIds, setLocalIds] = useState<Set<string>>(new Set())
    const [menuId, setMenuId] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [finishing, setFinishing] = useState<BookItem | null>(null)
    const [addingPending, setAddingPending] = useState(false)
    const [coverFor, setCoverFor] = useState<PendingBook | null>(null)
    const [startMediaId, setStartMediaId] = useState<string | null>(null)

    // Los pendientes sin tapa la buscan solos, una vez por carga.
    const missingCovers = pending.filter(p => !p.cover_url).length
    useEffect(() => {
        if (!missingCovers) return
        let cancelled = false
        fillMissingCovers().then(res => {
            if (!cancelled && res.ok && res.data.filled > 0) router.refresh()
        })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [missingCovers])

    useEffect(() => {
        listLocalBookIds().then(ids => setLocalIds(new Set(ids)))
    }, [books])

    useEffect(() => {
        if (!menuId) return
        const close = () => setMenuId(null)
        window.addEventListener('click', close)
        return () => window.removeEventListener('click', close)
    }, [menuId])

    const reading = books.filter(b => b.status === 'reading')
    const finished = books
        .filter(b => b.status === 'finished')
        .sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''))
    const thisYear = new Date().getFullYear()
    const finishedThisYear = finished.filter(b => b.finished_at && new Date(b.finished_at).getFullYear() === thisYear).length
    const storageUsed = books.reduce((sum, b) => sum + (b.file_path ? b.file_size || 0 : 0), 0)

    async function run(id: string, fn: () => Promise<ActionResult<unknown>>) {
        setBusyId(id)
        setMenuId(null)
        const res = await fn()
        setBusyId(null)
        if (!res.ok) return alert(res.error)
        router.refresh()
    }

    async function handleDelete(book: BookItem) {
        if (!confirm(`¿Eliminar "${book.title}" de la biblioteca? Se borra el PDF. La ficha en Entretenimiento se conserva.`)) return
        await deleteLocalBook(book.id)
        await run(book.id, () => deleteBook(book.id))
    }

    async function handleRemoveFile(book: BookItem) {
        if (!confirm(`¿Borrar el PDF de "${book.title}"? Liberás ${formatBytes(book.file_size)}. El libro sigue en tus leídos.`)) return
        await deleteLocalBook(book.id)
        await run(book.id, () => removeBookFile(book.id))
    }

    async function handleForgetLocal(book: BookItem) {
        setMenuId(null)
        await deleteLocalBook(book.id)
        setLocalIds(prev => {
            const next = new Set(prev)
            next.delete(book.id)
            return next
        })
    }

    async function handleReopen(book: BookItem) {
        setBusyId(book.id)
        setMenuId(null)
        const res = await reopenBook(book.id)
        setBusyId(null)
        if (!res.ok) return alert(res.error)
        router.push(`/leer/${book.id}`)
    }

    async function handleRemovePending(p: PendingBook) {
        if (!confirm(`¿Sacar "${p.title}" de pendientes?`)) return
        await run(p.id, () => removePendingBook(p.id))
    }

    const list = tab === 'leyendo' ? reading : finished

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <LibraryBig className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Biblioteca</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Tus PDFs, abiertos en la página donde quedaste, en cualquier dispositivo.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 self-start sm:self-auto">
                    <button
                        onClick={() => setAddingPending(true)}
                        className="px-4 py-2.5 bg-secondary/70 hover:bg-secondary border border-border text-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                        <BookMarked className="w-4 h-4" /> Quiero leer
                    </button>
                    <button
                        onClick={() => { setStartMediaId(null); setAdding(true) }}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Agregar PDF
                    </button>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Pendientes', value: pending.length, icon: BookMarked },
                    { label: 'Leyendo', value: reading.length, icon: BookOpen },
                    { label: `Leídos en ${thisYear}`, value: finishedThisYear, icon: Trophy },
                    { label: 'Espacio usado', value: formatBytes(storageUsed), icon: HardDriveDownload }
                ].map(s => (
                    <div key={s.label} className="glass rounded-2xl border border-border/50 p-3 md:p-4">
                        <s.icon className="w-4 h-4 text-amber-400 mb-1.5" />
                        <div className="text-lg md:text-xl font-heading font-bold">{s.value}</div>
                        <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50">
                {[
                    { id: 'pendientes', label: `Pendientes (${pending.length})`, icon: BookMarked },
                    { id: 'leyendo', label: `Leyendo (${reading.length})`, icon: BookOpen },
                    { id: 'leidos', label: `Leídos (${finished.length})`, icon: Trophy }
                ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as Tab)}
                            className={cn(
                                'flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-4 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex-1 min-w-0',
                                active ? 'bg-amber-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{t.label}</span>
                        </button>
                    )
                })}
            </div>

            {tab === 'pendientes' ? (
                pending.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                            <BookMarked className="w-8 h-8 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">Tu lista de pendientes está vacía</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Anotá los libros que querés leer con solo el título. La tapa se busca sola y el PDF lo subís cuando lo empieces.
                        </p>
                        <button
                            onClick={() => setAddingPending(true)}
                            className="mt-5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        >
                            <BookMarked className="w-4 h-4" /> Quiero leer…
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <AnimatePresence mode="popLayout">
                            {pending.map(p => (
                                <motion.div
                                    layout
                                    key={p.id}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    className="group relative"
                                >
                                    <button
                                        onClick={() => { setStartMediaId(p.id); setAdding(true) }}
                                        className="block w-full text-left"
                                    >
                                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-xl shadow-black/30 bg-secondary">
                                            {p.cover_url ? (
                                                <img src={p.cover_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-br from-amber-900/40 to-secondary">
                                                    {missingCovers > 0 && <Loader2 className="w-4 h-4 animate-spin text-amber-300/70" />}
                                                    <span className="font-heading font-bold text-sm leading-snug">{p.title}</span>
                                                </div>
                                            )}
                                            {busyId === p.id && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <span className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold bg-amber-500 text-black rounded-lg py-1.5">
                                                    <FileUp className="w-3.5 h-3.5" /> Empezar: subir PDF
                                                </span>
                                            </div>
                                            {p.status === 'Active' && (
                                                <div className="absolute top-2 left-2 text-[10px] font-bold bg-sky-500/90 text-black px-2 py-0.5 rounded-full">
                                                    Empezado
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2.5 px-0.5">
                                            <h3 className="font-semibold text-sm leading-snug line-clamp-2">{p.title}</h3>
                                            {p.author_or_studio && <p className="text-xs text-muted-foreground truncate">{p.author_or_studio}</p>}
                                        </div>
                                    </button>

                                    <button
                                        onClick={e => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id) }}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white/90 hover:bg-black/75 backdrop-blur-sm"
                                        aria-label="Opciones"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {menuId === p.id && (
                                        <div
                                            onClick={e => e.stopPropagation()}
                                            className="absolute top-10 right-2 z-20 w-52 bg-popover border border-white/10 rounded-xl shadow-2xl p-1 text-sm"
                                        >
                                            <MenuItem icon={FileUp} onClick={() => { setMenuId(null); setStartMediaId(p.id); setAdding(true) }}>
                                                Empezar a leer
                                            </MenuItem>
                                            <MenuItem icon={ImageIcon} onClick={() => { setMenuId(null); setCoverFor(p) }}>
                                                Cambiar tapa
                                            </MenuItem>
                                            <MenuItem icon={Trash2} danger onClick={() => handleRemovePending(p)}>
                                                Sacar de pendientes
                                            </MenuItem>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )
            ) : list.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                        {tab === 'leyendo' ? <BookOpen className="w-8 h-8 text-amber-400" /> : <Trophy className="w-8 h-8 text-amber-400" />}
                    </div>
                    <h3 className="text-lg font-heading font-medium">
                        {tab === 'leyendo' ? 'No estás leyendo nada' : 'Todavía no terminaste ningún libro acá'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {tab === 'leyendo'
                            ? 'Subí el PDF que estás leyendo. Queda en tu cuenta y retomás donde quedaste desde el celu o la compu.'
                            : 'Cuando termines un libro en el lector se archiva acá y queda como leído en Entretenimiento.'}
                    </p>
                    {tab === 'leyendo' && (
                        <button
                            onClick={() => setAdding(true)}
                            className="mt-5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" /> Agregar PDF
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {list.map(book => {
                            const pct = Math.round((book.current_page / book.page_count) * 100)
                            const isLocal = localIds.has(book.id)
                            const canOpen = !!book.file_path
                            const isFinished = book.status === 'finished'

                            return (
                                <motion.div
                                    layout
                                    key={book.id}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    className="group relative"
                                >
                                    <Link
                                        href={canOpen ? `/leer/${book.id}` : '#'}
                                        onClick={e => { if (!canOpen) e.preventDefault() }}
                                        className={cn('block', !canOpen && 'cursor-default')}
                                    >
                                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-xl shadow-black/30 bg-secondary">
                                            {book.cover ? (
                                                <img src={book.cover} alt="" className={cn('w-full h-full object-cover transition-transform duration-300', canOpen && 'group-hover:scale-[1.03]')} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center p-4 text-center bg-gradient-to-br from-amber-900/40 to-secondary">
                                                    <span className="font-heading font-bold text-sm leading-snug">{book.title}</span>
                                                </div>
                                            )}

                                            {busyId === book.id && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                </div>
                                            )}

                                            {!isFinished && (
                                                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
                                                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                                                </div>
                                            )}

                                            {isFinished && (
                                                <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold bg-emerald-500/90 text-black px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Leído
                                                </div>
                                            )}

                                            {!canOpen && (
                                                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] bg-black/70 text-white/80 px-2 py-0.5 rounded-full">
                                                    <CloudOff className="w-3 h-3" /> Sin PDF
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2.5 px-0.5">
                                            <h3 className="font-semibold text-sm leading-snug line-clamp-2">{book.title}</h3>
                                            {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
                                            {isFinished ? (
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                                    {book.finished_at && <span>{format(new Date(book.finished_at), "d MMM yyyy", { locale: es })}</span>}
                                                    {book.rating != null && (
                                                        <span className="flex items-center gap-0.5 text-yellow-400 font-semibold">
                                                            <Star className="w-3 h-3 fill-yellow-400" /> {book.rating.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-muted-foreground mt-1">
                                                    Pág {book.current_page} de {book.page_count} · <span className="text-amber-300 font-semibold">{pct}%</span>
                                                </p>
                                            )}
                                            {!isFinished && (
                                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                                                    {isLocal && <Smartphone className="w-3 h-3 text-emerald-400" aria-label="Descargado en este dispositivo" />}
                                                    {formatDistanceToNow(new Date(book.progress_updated_at), { locale: es, addSuffix: true })}
                                                </p>
                                            )}
                                        </div>
                                    </Link>

                                    {/* Menú */}
                                    <button
                                        onClick={e => { e.stopPropagation(); setMenuId(menuId === book.id ? null : book.id) }}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white/90 hover:bg-black/75 backdrop-blur-sm"
                                        aria-label="Opciones"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {menuId === book.id && (
                                        <div
                                            onClick={e => e.stopPropagation()}
                                            className="absolute top-10 right-2 z-20 w-56 bg-popover border border-white/10 rounded-xl shadow-2xl p-1 text-sm"
                                        >
                                            {!isFinished && (
                                                <MenuItem icon={CheckCircle2} onClick={() => { setMenuId(null); setFinishing(book) }}>
                                                    Marcar como leído
                                                </MenuItem>
                                            )}
                                            {isFinished && canOpen && (
                                                <MenuItem icon={RotateCcw} onClick={() => handleReopen(book)}>
                                                    Volver a leer
                                                </MenuItem>
                                            )}
                                            {isLocal && (
                                                <MenuItem icon={Smartphone} onClick={() => handleForgetLocal(book)}>
                                                    Quitar de este dispositivo
                                                </MenuItem>
                                            )}
                                            {isFinished && canOpen && (
                                                <MenuItem icon={CloudOff} onClick={() => handleRemoveFile(book)}>
                                                    Borrar PDF ({formatBytes(book.file_size)})
                                                </MenuItem>
                                            )}
                                            <MenuItem icon={Trash2} danger onClick={() => handleDelete(book)}>
                                                Eliminar libro
                                            </MenuItem>
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}

            {adding && (
                <AddBookModal
                    linkable={linkable}
                    presetMediaId={startMediaId}
                    onClose={() => { setAdding(false); setStartMediaId(null) }}
                    onAdded={id => router.push(`/leer/${id}`)}
                />
            )}

            {(addingPending || coverFor) && (
                <AddPendingBookModal
                    editing={coverFor ? { id: coverFor.id, title: coverFor.title, author: coverFor.author_or_studio } : null}
                    onClose={() => { setAddingPending(false); setCoverFor(null) }}
                    onSaved={() => {
                        setAddingPending(false)
                        setCoverFor(null)
                        setTab('pendientes')
                        router.refresh()
                    }}
                />
            )}

            {finishing && (
                <RatingModal
                    title={finishing.title}
                    onClose={() => setFinishing(null)}
                    onSubmit={async rating => {
                        const res = await finishBook(finishing.id, rating)
                        if (!res.ok) throw new Error(res.error)
                        setTab('leidos')
                        router.refresh()
                    }}
                />
            )}
        </div>
    )
}

function MenuItem({ icon: Icon, children, onClick, danger }: {
    icon: React.ComponentType<{ className?: string }>
    children: React.ReactNode
    onClick: () => void
    danger?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                danger ? 'text-red-400 hover:bg-red-500/10' : 'text-foreground/90 hover:bg-white/5'
            )}
        >
            <Icon className="w-4 h-4 shrink-0" />
            {children}
        </button>
    )
}
