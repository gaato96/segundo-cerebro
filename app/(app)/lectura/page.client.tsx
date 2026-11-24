'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BookOpen, MoreVertical, Trash2, RotateCcw, CloudOff, CheckCircle2, Smartphone, BookMarked, FileUp, ImageIcon } from 'lucide-react'
import { PageShell, PageHeader, EmptyState } from '@/components/ui/kit'
import { Segmented, Bar } from '@/components/ui/controls'
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
    read: { id: string; title: string; cover_url: string | null; rating: number | null }[]
    initialTab: Tab
}

type Tab = 'pendientes' | 'leyendo' | 'leidos'

export function LibraryClient({ books, linkable, pending, read, initialTab }: Props) {
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

    const main = reading.find(b => b.file_path) || reading[0]
    const others = reading.filter(b => b.id !== main?.id)
    const pct = (b: BookItem) => Math.round((b.current_page / b.page_count) * 100)
    const startPending = (id: string) => { setMenuId(null); setStartMediaId(id); setAdding(true) }

    const BookMenu = ({ b }: { b: BookItem }) => (
        <div className="relative">
            <button onClick={e => { e.stopPropagation(); setMenuId(menuId === b.id ? null : b.id) }} aria-label="Opciones" className="w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center"><MoreVertical className="w-4 h-4" /></button>
            {menuId === b.id && <div onClick={e => e.stopPropagation()} className="absolute top-10 right-0 z-30 w-56 bg-popover border border-hairline rounded-xl shadow-2xl p-1 text-sm">
                {b.status === 'reading' && <MenuItem icon={CheckCircle2} onClick={() => { setMenuId(null); setFinishing(b) }}>Marcar como leído</MenuItem>}
                {b.status === 'finished' && b.file_path && <MenuItem icon={RotateCcw} onClick={() => handleReopen(b)}>Volver a leer</MenuItem>}
                {localIds.has(b.id) && <MenuItem icon={Smartphone} onClick={() => handleForgetLocal(b)}>Quitar de este dispositivo</MenuItem>}
                {b.status === 'finished' && b.file_path && <MenuItem icon={CloudOff} onClick={() => handleRemoveFile(b)}>Borrar PDF ({formatBytes(b.file_size)})</MenuItem>}
                <MenuItem icon={Trash2} danger onClick={() => handleDelete(b)}>Eliminar libro</MenuItem>
            </div>}
        </div>
    )

    return (
        <PageShell wide>
            <PageHeader label="Vida · lectura" title="Biblioteca" subtitle="Tus libros, abiertos en la página donde quedaste, en cualquier dispositivo."
                actions={<><button onClick={() => setAddingPending(true)} className="btn-secondary text-sm"><BookMarked className="w-4 h-4" /> Quiero leer</button><button onClick={() => { setStartMediaId(null); setAdding(true) }} className="btn-primary text-sm"><FileUp className="w-4 h-4" /> Subir PDF</button></>} />
            <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground mb-6">{([['Pendientes', pending.length], ['Leyendo', reading.length], [`Leídos en ${thisYear}`, finishedThisYear], ['Espacio', formatBytes(storageUsed)]] as [string, React.ReactNode][]).map(([l, v]) => <span key={l}>{l} <span className="font-mono text-foreground">{v}</span></span>)}</p>
            <Segmented className="mb-6" value={tab} onChange={setTab} options={[{ id: 'pendientes', label: 'Pendientes', count: pending.length }, { id: 'leyendo', label: 'Leyendo', count: reading.length }, { id: 'leidos', label: 'Leídos', count: finished.length + read.length }]} />

            {tab === 'leyendo' && (!main ? <EmptyState icon={BookOpen} title="No estás leyendo nada" hint="Subí un PDF o empezá uno de tus pendientes." /> : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <article className="lg:col-span-7 lamp rounded-2xl p-5 md:p-6 flex gap-5 md:gap-7">
                        <Cover src={main.cover} title={main.title} className="w-28 md:w-44 shrink-0 self-start" />
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-2"><p className="label-caps !text-amber-300">{formatDistanceToNow(new Date(main.progress_updated_at), { locale: es, addSuffix: true })}</p><BookMenu b={main} /></div>
                            <h2 className="text-lg md:text-2xl font-semibold leading-snug">{main.title}</h2>{main.author && <p className="text-sm text-muted-foreground mt-1">{main.author}</p>}
                            <div className="mt-auto pt-6"><p className="font-mono text-xs flex justify-between mb-2"><span className="text-muted-foreground">pág {main.current_page} de {main.page_count}</span><span>{pct(main)}%</span></p><Bar pct={pct(main)} tone="amber" /></div>
                            <div className="flex flex-wrap gap-2 mt-5">{main.file_path ? <Link href={`/leer/${main.id}`} className="btn-primary text-sm"><BookOpen className="w-4 h-4" /> Seguir leyendo</Link> : <span className="text-sm text-muted-foreground">Sin PDF</span>}<Link href="/notas" className="btn-secondary text-sm">Notas</Link></div>
                        </div>
                    </article>
                    <div className="lg:col-span-5 rounded-2xl bg-card border border-hairline divide-y divide-hairline self-start">{others.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Un libro a la vez. Los próximos esperan en Pendientes.</p> : others.map(b => <div key={b.id} className="flex items-center gap-4 p-4"><Link href={b.file_path ? `/leer/${b.id}` : '#'} className="flex items-center gap-4 flex-1 min-w-0"><Cover src={b.cover} title={b.title} className="w-14 shrink-0" /><span className="flex-1 min-w-0"><span className="block text-sm font-medium line-clamp-2">{b.title}</span><span className="block text-xs text-muted-foreground truncate">{b.author}</span><span className="block font-mono text-[11px] text-muted-foreground mt-2 mb-1">pág {b.current_page} de {b.page_count} · {pct(b)}%</span><Bar pct={pct(b)} /></span></Link><BookMenu b={b} /></div>)}</div>
                </div>
            ))}

            {tab === 'pendientes' && (pending.length === 0 ? <EmptyState icon={BookMarked} title="Tu lista está vacía" hint="Anotá un título: la tapa se busca sola y el PDF lo subís cuando lo empieces." /> : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-7">{pending.map(x => (
                    <article key={x.id} className="relative min-w-0">
                        <button onClick={() => startPending(x.id)} className="block w-full text-left"><Cover src={x.cover_url} title={x.title} busy={busyId === x.id} /><span className="block text-sm font-medium leading-snug mt-2 line-clamp-2">{x.title}</span><span className="block text-xs text-muted-foreground truncate">{x.author_or_studio}</span></button>
                        <div className="flex items-center -ml-2"><button onClick={() => startPending(x.id)} className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground">Empezar</button><button onClick={() => setCoverFor(x)} aria-label="Cambiar tapa" className="w-9 h-9 text-ink-faint hover:text-foreground flex items-center justify-center"><ImageIcon className="w-3.5 h-3.5" /></button><button onClick={() => handleRemovePending(x)} aria-label="Sacar" className="w-9 h-9 text-ink-faint hover:text-red-300 flex items-center justify-center ml-auto"><Trash2 className="w-3.5 h-3.5" /></button></div>
                    </article>))}</div>
            ))}

            {tab === 'leidos' && (finished.length + read.length === 0 ? <EmptyState icon={BookOpen} title="Todavía no terminaste ninguno" /> : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-7">
                    {finished.map(b => <article key={b.id}><Link href={b.file_path ? `/leer/${b.id}` : '#'}><Cover src={b.cover} title={b.title} busy={busyId === b.id} /></Link><div className="flex items-start mt-2"><div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-2">{b.title}</p><p className="font-mono text-[11px] text-muted-foreground">{b.finished_at && format(new Date(b.finished_at), 'd MMM yyyy', { locale: es })}{b.rating != null && ` · ${b.rating.toFixed(1)}`}</p></div><BookMenu b={b} /></div></article>)}
                    {read.map(b => <article key={b.id}><Cover src={b.cover_url} title={b.title} /><p className="text-sm font-medium line-clamp-2 mt-2">{b.title}</p><p className="font-mono text-[11px] text-muted-foreground">sin PDF{b.rating != null ? ` · ${Number(b.rating).toFixed(1)}` : ''}</p></article>)}
                </div>
            ))}

            {adding && <AddBookModal linkable={linkable} presetMediaId={startMediaId} onClose={() => { setAdding(false); setStartMediaId(null) }} onAdded={id => router.push(`/leer/${id}`)} />}
            {(addingPending || coverFor) && <AddPendingBookModal editing={coverFor ? { id: coverFor.id, title: coverFor.title, author: coverFor.author_or_studio } : null} onClose={() => { setAddingPending(false); setCoverFor(null) }} onSaved={() => { setAddingPending(false); setCoverFor(null); setTab('pendientes'); router.refresh() }} />}
            {finishing && <RatingModal title={finishing.title} onClose={() => setFinishing(null)} onSubmit={async rating => { const res = await finishBook(finishing.id, rating); if (!res.ok) throw new Error(res.error); setFinishing(null); setTab('leidos'); router.refresh() }} />}
        </PageShell>
    )
}

function Cover({ src, title, className, busy }: { src?: string | null; title: string; className?: string; busy?: boolean }) {
    return <span className={cn('relative block aspect-[2/3] rounded-xl overflow-hidden border border-hairline bg-raised', busy && 'opacity-50', className)}>{src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full p-3 flex items-center justify-center text-center text-sm font-medium">{title}</span>}</span>
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
