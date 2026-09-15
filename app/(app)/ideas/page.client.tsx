'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Lightbulb, Plus, Sparkles, Loader2, Trash2, CheckSquare, Target,
    Archive, X, ArrowUpRight, Flame, Inbox, Check
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    IdeaItem, createIdea, deleteIdea, updateIdea, saveNoteAsIdea,
    promoteIdeaToTask, promoteIdeaToObjective, reviewIdeaBank, applyIdeaScores
} from '@/lib/actions/ideas'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
    initialIdeas: IdeaItem[]
    archivedNotes: { id: string; content: string; created_at: string; processed_as: string | null }[]
}

const STATUS_LABEL: Record<string, string> = {
    raw: 'Sin mirar',
    exploring: 'Explorando',
    promoted: 'Ya la convertí',
    archived: 'Archivada'
}

const STATUS_STYLE: Record<string, string> = {
    raw: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    exploring: 'text-sky-400 bg-sky-500/10 border-sky-500/25',
    promoted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    archived: 'text-muted-foreground bg-secondary/50 border-border'
}

export function IdeasClient({ initialIdeas, archivedNotes }: Props) {
    const router = useRouter()
    const [tab, setTab] = useState<'banco' | 'archivo'>('banco')
    const [ideas, setIdeas] = useState(initialIdeas)
    const [filter, setFilter] = useState<'all' | 'raw' | 'exploring' | 'promoted' | 'archived'>('all')
    const [sortBy, setSortBy] = useState<'recent' | 'leverage'>('recent')

    const [modalOpen, setModalOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [saving, setSaving] = useState(false)

    const [busyId, setBusyId] = useState<string | null>(null)
    const [reviewing, setReviewing] = useState(false)
    const [review, setReview] = useState<any>(null)
    const [reviewError, setReviewError] = useState('')
    const [applyingScores, setApplyingScores] = useState(false)

    const visible = ideas
        .filter(i => filter === 'all' ? true : i.status === filter)
        .sort((a, b) => {
            if (sortBy === 'leverage') {
                // Mucho impacto y poco esfuerzo primero. Las no puntuadas, al final.
                const score = (x: IdeaItem) => (x.impact || 0) - (x.effort || 0) * 0.8
                const diff = score(b) - score(a)
                if (diff !== 0) return diff
            }
            return b.created_at.localeCompare(a.created_at)
        })

    const counts = {
        raw: ideas.filter(i => i.status === 'raw').length,
        exploring: ideas.filter(i => i.status === 'exploring').length,
        promoted: ideas.filter(i => i.status === 'promoted').length,
        archived: ideas.filter(i => i.status === 'archived').length
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return
        setSaving(true)
        const res = await createIdea({ title, content: content.trim() || null })
        setSaving(false)
        if ('error' in res && res.error) return alert(res.error)
        setTitle('')
        setContent('')
        setModalOpen(false)
        router.refresh()
    }

    async function handleStatus(id: string, status: IdeaItem['status']) {
        setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i))
        await updateIdea(id, { status })
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Borrar esta idea del banco? Esto sí la elimina.')) return
        setIdeas(prev => prev.filter(i => i.id !== id))
        await deleteIdea(id)
    }

    async function handlePromoteTask(id: string) {
        setBusyId(id)
        const res = await promoteIdeaToTask(id)
        setBusyId(null)
        if ('error' in res && res.error) return alert(res.error)
        setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'promoted', promoted_to: 'task' } : i))
        router.refresh()
    }

    async function handlePromoteObjective(id: string) {
        setBusyId(id)
        const res = await promoteIdeaToObjective(id)
        setBusyId(null)
        if ('error' in res && res.error) return alert(res.error)
        setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'promoted', promoted_to: 'objective' } : i))
        router.refresh()
    }

    async function handleRescue(noteId: string) {
        setBusyId(noteId)
        const res = await saveNoteAsIdea(noteId)
        setBusyId(null)
        if ('error' in res && res.error) return alert(res.error)
        router.refresh()
    }

    async function handleReview() {
        setReviewing(true)
        setReviewError('')
        try {
            const res = await reviewIdeaBank()
            if (!res.ok) {
                setReviewError(res.error)
                return
            }
            setReview(res.data)
        } catch (e: any) {
            setReviewError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setReviewing(false)
        }
    }

    async function handleApplyScores() {
        if (!review?.scored?.length) return
        setApplyingScores(true)
        await applyIdeaScores(review.scored.map((s: any) => ({
            id: s.id, impact: s.impact, effort: s.effort, category: s.category
        })))
        setApplyingScores(false)
        setReview(null)
        router.refresh()
    }

    const rescuedNoteIds = new Set(ideas.map(i => i.source_note_id).filter(Boolean))

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lightbulb className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Banco de Ideas</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Donde van a parar las ideas que archivás. No se borran: esperan su momento.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setModalOpen(true)}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition-all self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" /> Nueva Idea
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50">
                {[
                    { id: 'banco', label: `Banco (${ideas.length})`, icon: Lightbulb },
                    { id: 'archivo', label: `Archivo de capturas (${archivedNotes.length})`, icon: Archive }
                ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as 'banco' | 'archivo')}
                            className={cn(
                                'flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex-1',
                                active ? 'bg-amber-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'banco' && (
                <div className="space-y-5">
                    {/* Curaduría con IA */}
                    <div className="glass p-5 rounded-2xl border border-violet-500/25 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-heading font-bold text-foreground">
                                    ¿Cuál de todas conviene empezar?
                                </h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    La IA puntúa impacto y esfuerzo mirando tu situación real y elige una sola.
                                </p>
                            </div>
                            <button
                                onClick={handleReview}
                                disabled={reviewing || ideas.length === 0}
                                className="px-4 py-2.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
                            >
                                {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Curar el banco
                            </button>
                        </div>

                        {reviewError && (
                            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 leading-relaxed break-words">
                                {reviewError}
                            </p>
                        )}

                        {review && (
                            <div className="space-y-3 pt-1">
                                {review.summary && (
                                    <p className="text-[11px] text-violet-300/90 leading-relaxed">{review.summary}</p>
                                )}

                                {review.top_pick && (
                                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-emerald-400">
                                            <Flame className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Empezá por esta</span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">{review.top_pick.title}</p>
                                        {review.top_pick.why && (
                                            <p className="text-[11px] text-muted-foreground">{review.top_pick.why}</p>
                                        )}
                                        {review.top_pick.first_step && (
                                            <p className="text-[11px] text-emerald-300">
                                                Primer paso: {review.top_pick.first_step}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {review.prune?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Conviene soltar
                                        </span>
                                        {review.prune.map((p: any) => (
                                            <div key={p.id} className="flex items-start justify-between gap-2 text-[11px] bg-secondary/40 border border-border/50 rounded-xl p-2.5">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{p.title}</p>
                                                    <p className="text-muted-foreground">{p.why}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleStatus(p.id, 'archived')}
                                                    className="shrink-0 px-2.5 py-1 bg-secondary border border-border rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                                                >
                                                    Archivar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {review.scored?.length > 0 && (
                                    <button
                                        onClick={handleApplyScores}
                                        disabled={applyingScores}
                                        className="w-full py-2.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {applyingScores ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        Guardar las puntuaciones de las {review.scored.length} ideas
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Filtros */}
                    <div className="glass p-3 rounded-2xl border border-border/50 flex flex-wrap items-center gap-2">
                        {([
                            { id: 'all', label: `Todas (${ideas.length})` },
                            { id: 'raw', label: `Sin mirar (${counts.raw})` },
                            { id: 'exploring', label: `Explorando (${counts.exploring})` },
                            { id: 'promoted', label: `Convertidas (${counts.promoted})` },
                            { id: 'archived', label: `Archivadas (${counts.archived})` }
                        ] as const).map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={cn(
                                    'px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all',
                                    filter === f.id
                                        ? 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                                        : 'bg-black/20 border-white/10 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {f.label}
                            </button>
                        ))}

                        <button
                            onClick={() => setSortBy(s => s === 'recent' ? 'leverage' : 'recent')}
                            className="ml-auto px-3 py-1.5 rounded-xl border border-white/10 bg-black/20 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                            {sortBy === 'recent' ? 'Ordenar por impacto' : 'Ordenar por fecha'}
                        </button>
                    </div>

                    {/* Lista */}
                    <div className="space-y-3">
                        {visible.length === 0 && (
                            <div className="text-center py-16 glass rounded-2xl border border-dashed border-border">
                                <Lightbulb className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    No hay ideas acá todavía. Cuando proceses el inbox con IA y mandes algo al
                                    Banco de Ideas, va a aparecer en esta lista.
                                </p>
                            </div>
                        )}

                        {visible.map(idea => (
                            <div
                                key={idea.id}
                                className="glass p-4 rounded-2xl border border-border/50 hover:border-amber-500/30 transition-all space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <h4 className="text-sm font-bold text-foreground leading-snug">{idea.title}</h4>
                                        {idea.content && idea.content !== idea.title && (
                                            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-4">
                                                {idea.content}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                            <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-semibold', STATUS_STYLE[idea.status])}>
                                                {STATUS_LABEL[idea.status]}
                                            </span>
                                            {idea.category && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground">
                                                    {idea.category}
                                                </span>
                                            )}
                                            {idea.impact != null && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
                                                    impacto {idea.impact}/5 · esfuerzo {idea.effort ?? '?'}/5
                                                </span>
                                            )}
                                            <span className="text-[9px] text-muted-foreground">
                                                {format(new Date(idea.created_at), "d 'de' MMM yyyy", { locale: es })}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(idea.id)}
                                        title="Borrar del banco"
                                        className="shrink-0 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                                    <button
                                        onClick={() => handlePromoteTask(idea.id)}
                                        disabled={busyId === idea.id}
                                        className="px-2.5 py-1.5 bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busyId === idea.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                                        Convertir en tarea
                                    </button>
                                    <button
                                        onClick={() => handlePromoteObjective(idea.id)}
                                        disabled={busyId === idea.id}
                                        className="px-2.5 py-1.5 bg-purple-600/15 hover:bg-purple-600/30 text-purple-300 border border-purple-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Target className="w-3 h-3" /> Convertir en objetivo
                                    </button>
                                    {idea.status !== 'exploring' && idea.status !== 'promoted' && (
                                        <button
                                            onClick={() => handleStatus(idea.id, 'exploring')}
                                            className="px-2.5 py-1.5 bg-sky-600/15 hover:bg-sky-600/30 text-sky-300 border border-sky-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                                        >
                                            <ArrowUpRight className="w-3 h-3" /> Estoy explorándola
                                        </button>
                                    )}
                                    {idea.status !== 'archived' && (
                                        <button
                                            onClick={() => handleStatus(idea.id, 'archived')}
                                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/70 text-muted-foreground border border-border rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                                        >
                                            <Archive className="w-3 h-3" /> Archivar
                                        </button>
                                    )}
                                    {idea.status === 'archived' && (
                                        <button
                                            onClick={() => handleStatus(idea.id, 'raw')}
                                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/70 text-muted-foreground border border-border rounded-lg text-[10px] font-semibold"
                                        >
                                            Devolver al banco
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'archivo' && (
                <div className="space-y-3">
                    <div className="glass p-4 rounded-2xl border border-sky-500/25">
                        <p className="text-[11px] text-sky-200/90 leading-relaxed">
                            Todas las capturas que procesaste alguna vez siguen acá: nada se borró nunca. Si la IA
                            te mandó una idea a "archivar" antes de que existiera el Banco de Ideas, la vas a
                            encontrar en esta lista. Tocá <strong>Rescatar como idea</strong> para traerla al banco.
                        </p>
                    </div>

                    {archivedNotes.length === 0 && (
                        <div className="text-center py-16 glass rounded-2xl border border-dashed border-border">
                            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">Todavía no procesaste ninguna captura.</p>
                        </div>
                    )}

                    {archivedNotes.map(note => {
                        const rescued = rescuedNoteIds.has(note.id)
                        return (
                            <div key={note.id} className="glass p-4 rounded-2xl border border-border/50 space-y-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground">
                                        {note.processed_as ? `procesada como ${note.processed_as}` : 'procesada'}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                        capturada el {format(new Date(note.created_at), "d 'de' MMM yyyy", { locale: es })}
                                    </span>
                                </div>
                                <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                <button
                                    onClick={() => handleRescue(note.id)}
                                    disabled={rescued || busyId === note.id}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border transition-all',
                                        rescued
                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 cursor-default'
                                            : 'bg-amber-600/15 hover:bg-amber-600/30 border-amber-500/25 text-amber-300'
                                    )}
                                >
                                    {busyId === note.id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : rescued ? <Check className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                                    {rescued ? 'Ya está en el banco' : 'Rescatar como idea'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal nueva idea */}
            <AnimatePresence>
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="glass border border-border/50 w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-foreground">Nueva idea</h3>
                                <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        La idea, en una línea *
                                    </label>
                                    <input
                                        required
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Ej: Armar un curso corto de branding para PyMEs"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        Desarrollo (opcional)
                                    </label>
                                    <textarea
                                        rows={5}
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        placeholder="Todo lo que se te venga: para quién es, por qué se te ocurrió, qué haría falta..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                    />
                                </div>
                                <div className="pt-1 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Guardar idea
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
