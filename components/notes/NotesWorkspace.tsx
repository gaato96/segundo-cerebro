'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import {
    Plus, Search, Pin, PinOff, Trash2, ArrowLeft, Eye, PenLine, Link2, NotebookPen, Target,
    CheckSquare, BookOpen, Loader2, CircleDashed, Quote
} from 'lucide-react'
import {
    createNote, updateNote, deleteNote, getNoteLinks, linkSuggestions,
    type NoteItem, type LinkTarget
} from '@/lib/actions/notes'
import { wikilinksToMarkdown, extractLinks } from '@/lib/wikilinks'
import { EmptyState, SectionLabel } from '@/components/ui/kit'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const TYPE_ICON: Record<string, any> = { note: NotebookPen, objective: Target, task: CheckSquare, book: BookOpen, missing: CircleDashed }
const TYPE_LABEL: Record<string, string> = { note: 'Nota', objective: 'Objetivo', task: 'Tarea', book: 'Libro', missing: 'Sin crear' }

type Links = Awaited<ReturnType<typeof getNoteLinks>>

export function NotesWorkspace({ initialNotes, initialId, startNew }: { initialNotes: NoteItem[]; initialId: string | null; startNew: boolean }) {
    const router = useRouter()
    const [notes, setNotes] = useState(initialNotes)
    const [activeId, setActiveId] = useState<string | null>(initialId || initialNotes[0]?.id || null)
    const [query, setQuery] = useState('')
    const [tag, setTag] = useState<string | null>(null)
    const [mode, setMode] = useState<'edit' | 'read'>('read')
    const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
    const [links, setLinks] = useState<Links | null>(null)
    const [mobileEditor, setMobileEditor] = useState(!!initialId)
    const [error, setError] = useState('')
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const textRef = useRef<HTMLTextAreaElement>(null)
    const createdOnce = useRef(false)

    const active = notes.find(n => n.id === activeId) || null

    const newNote = useCallback(async (title?: string) => {
        setError('')
        const res = await createNote({ title: title || 'Sin título' })
        if (!res.ok) return setError(res.error)
        setNotes(prev => [res.data, ...prev])
        setActiveId(res.data.id)
        setMode('edit')
        setMobileEditor(true)
        router.replace(`/notas?id=${res.data.id}`, { scroll: false })
    }, [router])

    useEffect(() => {
        if (startNew && !createdOnce.current) {
            createdOnce.current = true
            newNote()
        }
    }, [startNew, newNote])

    // Una nota nueva o vacía se abre para escribir; el resto para leer.
    useEffect(() => {
        if (!active) return
        setMode(active.content.trim() ? 'read' : 'edit')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId])

    // Enlaces y backlinks de la nota activa.
    useEffect(() => {
        if (!active) { setLinks(null); return }
        let alive = true
        const t = setTimeout(() => {
            getNoteLinks(active.id, active.title, active.content).then(l => alive && setLinks(l)).catch(() => { })
        }, 400)
        return () => { alive = false; clearTimeout(t) }
    }, [active?.id, active?.title, active?.content]) // eslint-disable-line react-hooks/exhaustive-deps

    function patchActive(patch: Partial<NoteItem>) {
        if (!active) return
        const id = active.id
        setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)))
        setSaving('saving')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
            const res = await updateNote(id, patch)
            setSaving(res.ok ? 'saved' : 'idle')
            if (!res.ok) setError(res.error)
        }, 700)
    }

    async function remove() {
        if (!active || !confirm(`¿Borrar la nota "${active.title}"?`)) return
        const id = active.id
        const res = await deleteNote(id)
        if (!res.ok) return setError(res.error)
        const rest = notes.filter(n => n.id !== id)
        setNotes(rest)
        setActiveId(rest[0]?.id || null)
        setMobileEditor(false)
    }

    const allTags = useMemo(() => {
        const count = new Map<string, number>()
        for (const n of notes) for (const t of n.tags || []) count.set(t, (count.get(t) || 0) + 1)
        return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    }, [notes])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return notes.filter(n =>
            (!tag || (n.tags || []).includes(tag)) &&
            (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
        )
    }, [notes, query, tag])

    async function openLink(title: string) {
        const target = links?.outgoing.find(l => l.title.toLowerCase() === title.toLowerCase())
        if (target?.url) {
            if (target.type === 'note' && target.id) {
                setActiveId(target.id)
                router.replace(`/notas?id=${target.id}`, { scroll: false })
            } else router.push(target.url)
            return
        }
        const existing = notes.find(n => n.title.toLowerCase() === title.toLowerCase())
        if (existing) { setActiveId(existing.id); return }
        if (confirm(`"${title}" todavía no existe. ¿Crear la nota?`)) newNote(title)
    }

    if (notes.length === 0 && !startNew) {
        return (
            <EmptyState
                icon={NotebookPen}
                title="Todavía no tenés notas"
                hint="Anotá lo que aprendés, decisiones y resúmenes. Escribí [[ para enlazar con objetivos, tareas, libros u otras notas."
                action={<button onClick={() => newNote()} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nueva nota</button>}
            />
        )
    }

    const wordCount = active ? active.content.trim().split(/\s+/).filter(Boolean).length : 0

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Lista */}
            <aside className={cn('lg:col-span-3 min-w-0 space-y-3', mobileEditor && 'hidden lg:block')}>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nota" className="field !min-h-10 h-10 pl-9 text-sm" />
                    </div>
                    <button onClick={() => newNote()} aria-label="Nueva nota" className="btn-primary !min-h-10 h-10 !px-3"><Plus className="w-4 h-4" /></button>
                </div>
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setTag(null)} className={cn('h-7 px-2.5 rounded-lg border text-xs', !tag ? 'lamp text-amber-200' : 'border-hairline text-muted-foreground')}>Todas · {notes.length}</button>
                        {allTags.map(([t, c]) => (
                            <button key={t} onClick={() => setTag(tag === t ? null : t)} className={cn('h-7 px-2.5 rounded-lg border text-xs font-mono', tag === t ? 'lamp text-amber-200' : 'border-hairline text-muted-foreground')}>
                                #{t} {c}
                            </button>
                        ))}
                    </div>
                )}
                <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline max-h-[70vh] overflow-y-auto">
                    {filtered.map(n => {
                        const linkCount = extractLinks(n.content).length
                        const isActive = n.id === activeId
                        return (
                            <button
                                key={n.id}
                                onClick={() => { setActiveId(n.id); setMobileEditor(true); router.replace(`/notas?id=${n.id}`, { scroll: false }) }}
                                className={cn('relative w-full text-left px-4 py-3 transition-colors', isActive ? 'bg-raised' : 'hover:bg-raised/50')}
                            >
                                {isActive && <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-amber-400" />}
                                <span className="flex items-center gap-1.5">
                                    {n.pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                                    {n.source === 'highlight' && <Quote className="w-3 h-3 text-muted-foreground shrink-0" />}
                                    <span className="text-sm font-medium truncate">{n.title}</span>
                                </span>
                                <span className="block text-xs text-muted-foreground truncate mt-0.5">{n.content.replace(/[#>*\[\]]/g, '').slice(0, 80) || 'Vacía'}</span>
                                <span className="flex items-center justify-between mt-1.5 font-mono text-[10px] text-ink-faint">
                                    <span>{formatDistanceToNow(new Date(n.updated_at), { locale: es, addSuffix: true })}</span>
                                    {linkCount > 0 && <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> {linkCount}</span>}
                                </span>
                            </button>
                        )
                    })}
                    {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nada coincide.</p>}
                </div>
            </aside>

            {/* Editor */}
            <section className={cn('lg:col-span-6 min-w-0', !mobileEditor && 'hidden lg:block')}>
                {active ? (
                    <div className="rounded-2xl bg-card border border-hairline">
                        <div className="flex items-center gap-2 px-4 md:px-6 h-12 border-b border-hairline">
                            <button onClick={() => setMobileEditor(false)} className="lg:hidden w-8 h-8 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground" aria-label="Volver">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-2">
                                <span className={cn('w-1.5 h-1.5 rounded-full', saving === 'saving' ? 'bg-amber-400 animate-breathe' : 'bg-emerald-400')} />
                                {saving === 'saving' ? 'Guardando…' : 'Guardado'} · {wordCount} palabras
                            </span>
                            <div className="ml-auto flex items-center gap-1">
                                <button onClick={() => setMode(mode === 'edit' ? 'read' : 'edit')} className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                                    {mode === 'edit' ? <><Eye className="w-3.5 h-3.5" /> Ver</> : <><PenLine className="w-3.5 h-3.5" /> Editar</>}
                                </button>
                                <button onClick={() => patchActive({ pinned: !active.pinned })} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label={active.pinned ? 'Desfijar' : 'Fijar'}>
                                    {active.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={remove} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-300" aria-label="Borrar">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="px-4 md:px-8 py-6 space-y-4">
                            <input
                                value={active.title}
                                onChange={e => patchActive({ title: e.target.value })}
                                className="w-full bg-transparent text-2xl font-semibold tracking-tight focus:outline-none placeholder:text-ink-faint"
                                placeholder="Título"
                            />
                            <TagsInput tags={active.tags || []} onChange={tags => patchActive({ tags })} />

                            {mode === 'edit' ? (
                                <WikiEditor
                                    textRef={textRef}
                                    value={active.content}
                                    onChange={content => patchActive({ content })}
                                />
                            ) : (
                                <div
                                    onDoubleClick={() => setMode('edit')}
                                    className="prose-note min-h-[40vh] max-w-[65ch] text-[15px] leading-relaxed"
                                >
                                    {active.content.trim() ? (
                                        <ReactMarkdown
                                            urlTransform={u => u}
                                            components={{
                                                a: ({ href, children }) => {
                                                    if (href?.startsWith('wikilink:')) {
                                                        const title = decodeURIComponent(href.slice(9))
                                                        const target = links?.outgoing.find(l => l.title.toLowerCase() === title.toLowerCase())
                                                        return (
                                                            <button onClick={() => openLink(title)} className={cn('px-1 rounded-md border-b', target?.type === 'missing' ? 'border-dashed border-muted-foreground text-muted-foreground' : 'border-amber-400/70 text-amber-200 bg-amber-400/5 hover:bg-amber-400/10')}>
                                                                {children}
                                                            </button>
                                                        )
                                                    }
                                                    return <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">{children}</a>
                                                }
                                            }}
                                        >
                                            {wikilinksToMarkdown(active.content)}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="text-muted-foreground">Vacía. Tocá Editar para escribir.</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="px-4 md:px-8 pb-4 font-mono text-[10px] text-ink-faint">Escribí [[ para enlazar · doble clic para editar</p>
                    </div>
                ) : (
                    <EmptyState icon={NotebookPen} title="Elegí una nota" />
                )}
                {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
            </section>

            {/* Enlaces */}
            <aside className={cn('lg:col-span-3 min-w-0 space-y-4', !mobileEditor && 'hidden lg:block')}>
                <div className="rounded-2xl bg-card border border-hairline p-4">
                    <SectionLabel right={links ? links.outgoing.length : undefined}>Enlaza a</SectionLabel>
                    {!links || links.outgoing.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin enlaces. Escribí [[ y el nombre de un objetivo, tarea, libro o nota.</p>
                    ) : (
                        <div className="space-y-1">
                            {links.outgoing.map(l => {
                                const Icon = TYPE_ICON[l.type]
                                return (
                                    <button key={l.title} onClick={() => openLink(l.title)} className="w-full flex items-center gap-2.5 min-h-[36px] px-2 -mx-2 rounded-lg hover:bg-raised/60 text-left">
                                        <Icon className={cn('w-3.5 h-3.5 shrink-0', l.type === 'missing' ? 'text-ink-faint' : 'text-muted-foreground')} />
                                        <span className={cn('text-sm truncate flex-1', l.type === 'missing' && 'text-muted-foreground')}>{l.title}</span>
                                        <span className="font-mono text-[10px] text-ink-faint">{TYPE_LABEL[l.type]}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl bg-card border border-hairline p-4">
                    <SectionLabel right={links ? links.backlinks.length : undefined}>Mencionada en</SectionLabel>
                    {!links || links.backlinks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nadie la menciona todavía.</p>
                    ) : (
                        <div className="space-y-3">
                            {links.backlinks.map(b => {
                                const Icon = TYPE_ICON[b.type]
                                return (
                                    <Link key={`${b.type}-${b.id}`} href={b.url} onClick={e => { if (b.type === 'note') { e.preventDefault(); setActiveId(b.id) } }} className="block rounded-xl border border-hairline p-3 hover:border-[hsl(var(--hairline-strong))]">
                                        <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                            <Icon className="w-3 h-3" /> {TYPE_LABEL[b.type]}
                                        </span>
                                        <span className="block text-sm font-medium mt-1">{b.title}</span>
                                        <span className="block text-xs text-muted-foreground italic mt-1 line-clamp-3">{b.excerpt}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    )
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
    const [draft, setDraft] = useState('')
    function commit() {
        const t = draft.trim().replace(/^#/, '').toLowerCase()
        if (t && !tags.includes(t)) onChange([...tags, t])
        setDraft('')
    }
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {tags.map(t => (
                <button key={t} onClick={() => onChange(tags.filter(x => x !== t))} title="Quitar" className="h-6 px-2 rounded-md bg-raised border border-hairline font-mono text-[11px] text-muted-foreground hover:text-red-300">
                    #{t}
                </button>
            ))}
            <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
                onBlur={commit}
                placeholder="+ etiqueta"
                className="h-6 w-24 bg-transparent font-mono text-[11px] focus:outline-none placeholder:text-ink-faint"
            />
        </div>
    )
}

/** Textarea con autocompletado de [[enlaces]]. */
function WikiEditor({ value, onChange, textRef }: { value: string; onChange: (v: string) => void; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
    const [suggest, setSuggest] = useState<{ query: string; start: number } | null>(null)
    const [options, setOptions] = useState<{ title: string; type: LinkTarget['type'] }[]>([])
    const [loading, setLoading] = useState(false)
    const [index, setIndex] = useState(0)

    useEffect(() => {
        const el = textRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.max(el.scrollHeight, 320)}px`
    }, [value, textRef])

    useEffect(() => {
        if (!suggest) { setOptions([]); return }
        let alive = true
        setLoading(true)
        const t = setTimeout(async () => {
            const res = await linkSuggestions(suggest.query).catch(() => [])
            if (alive) { setOptions(res); setIndex(0); setLoading(false) }
        }, 150)
        return () => { alive = false; clearTimeout(t) }
    }, [suggest?.query]) // eslint-disable-line react-hooks/exhaustive-deps

    function detect(text: string, caret: number) {
        const before = text.slice(0, caret)
        const open = before.lastIndexOf('[[')
        if (open < 0 || before.slice(open).includes(']]') || before.slice(open).includes('\n')) return setSuggest(null)
        const q = before.slice(open + 2)
        if (q.length > 60) return setSuggest(null)
        setSuggest({ query: q, start: open })
    }

    function insert(title: string) {
        const el = textRef.current
        if (!el || !suggest) return
        const caret = el.selectionStart
        const after = value.slice(caret).startsWith(']]') ? value.slice(caret + 2) : value.slice(caret)
        const next = `${value.slice(0, suggest.start)}[[${title}]]${after}`
        onChange(next)
        setSuggest(null)
        const pos = suggest.start + title.length + 4
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
    }

    const list = suggest ? [...options, ...(suggest.query.trim() && !options.some(o => o.title.toLowerCase() === suggest.query.trim().toLowerCase()) ? [{ title: suggest.query.trim(), type: 'missing' as const }] : [])] : []

    return (
        <div className="relative">
            <textarea
                ref={textRef}
                value={value}
                autoFocus
                onChange={e => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart) }}
                onKeyDown={e => {
                    if (!suggest || !list.length) return
                    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % list.length) }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + list.length) % list.length) }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(list[index].title) }
                    if (e.key === 'Escape') setSuggest(null)
                }}
                onClick={e => detect(value, (e.target as HTMLTextAreaElement).selectionStart)}
                placeholder={'Escribí acá. Markdown: # título, - lista, > cita.\nEnlazá con [[Primer cliente de automatización]].'}
                className="w-full min-h-[320px] bg-transparent resize-none text-[15px] leading-relaxed focus:outline-none placeholder:text-ink-faint font-sans"
            />
            {suggest && (
                <div className="absolute left-0 right-0 md:right-auto md:w-80 top-full mt-1 z-20 rounded-xl bg-popover border border-hairline shadow-2xl p-1">
                    {loading && !list.length ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…</p>
                    ) : list.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Escribí el nombre…</p>
                    ) : list.map((o, i) => {
                        const Icon = TYPE_ICON[o.type]
                        return (
                            <button
                                key={`${o.type}-${o.title}`}
                                onMouseDown={e => { e.preventDefault(); insert(o.title) }}
                                className={cn('w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-left text-sm', i === index ? 'bg-raised' : 'hover:bg-raised/60')}
                            >
                                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{o.type === 'missing' ? `Crear “${o.title}”` : o.title}</span>
                                <span className="font-mono text-[10px] text-ink-faint">{TYPE_LABEL[o.type]}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
