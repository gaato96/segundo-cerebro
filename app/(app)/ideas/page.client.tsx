'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb, Plus, Sparkles, Loader2, Trash2, CheckSquare, Target, Archive, Inbox, Check, Compass, RotateCcw } from 'lucide-react'
import {
    type IdeaItem, createIdea, deleteIdea, updateIdea, saveNoteAsIdea,
    promoteIdeaToTask, promoteIdeaToObjective, reviewIdeaBank, applyIdeaScores
} from '@/lib/actions/ideas'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState } from '@/components/ui/kit'
import { Modal, Field, Segmented } from '@/components/ui/controls'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
    initialIdeas: IdeaItem[]
    archivedNotes: { id: string; content: string; created_at: string; processed_as: string | null }[]
    initialTab?: 'banco' | 'archivo'
}

const STATUS: Record<string, string> = { raw: 'Sin mirar', exploring: 'Explorando', promoted: 'Convertida', archived: 'Archivada' }
const DEST: Record<string, string> = { task: 'tarea', event: 'evento', journal: 'journal', wishlist: 'deseo', idea: 'idea', expense: 'gasto', media: 'entretenimiento', note: 'referencia', discard: 'descartada', done: 'hecha' }
const quadrant = (i: IdeaItem) => i.impact == null || i.effort == null ? null
    : i.impact >= 4 ? (i.effort <= 3 ? 'Victoria rápida' : 'Proyecto mayor') : i.effort <= 3 ? 'Bajo esfuerzo' : 'Pensalo dos veces'

export function IdeasClient({ initialIdeas, archivedNotes, initialTab }: Props) {
    const router = useRouter()
    const [tab, setTab] = useState<'banco' | 'archivo'>(initialTab || 'banco')
    const [ideas, setIdeas] = useState(initialIdeas)
    const [status, setStatus] = useState<'open' | 'exploring' | 'promoted' | 'archived'>('open')
    const [category, setCategory] = useState<string | null>(null)
    const [sort, setSort] = useState<'recent' | 'leverage'>('leverage')
    const [modal, setModal] = useState(false)
    const [draft, setDraft] = useState({ title: '', content: '', category: 'General' })
    const [saving, setSaving] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [reviewing, setReviewing] = useState(false)
    const [review, setReview] = useState<any>(null)
    const [error, setError] = useState('')

    useEffect(() => { setIdeas(initialIdeas) }, [initialIdeas])

    const categories = Array.from(new Set(ideas.map(i => i.category).filter(Boolean))) as string[]
    const score = (x: IdeaItem) => (x.impact || 0) - (x.effort || 0) * 0.8
    const visible = ideas
        .filter(i => status === 'open' ? i.status === 'raw' || i.status === 'exploring' : i.status === status)
        .filter(i => !category || i.category === category)
        .sort((a, b) => (sort === 'leverage' ? score(b) - score(a) : 0) || b.created_at.localeCompare(a.created_at))
    const open = ideas.filter(i => i.status === 'raw' || i.status === 'exploring')
    const scored = open.filter(i => i.impact != null && i.effort != null)
    const quick = scored.filter(i => quadrant(i) === 'Victoria rápida')
    const n = (s: string) => ideas.filter(i => i.status === s).length
    const rescued = new Set(ideas.map(i => i.source_note_id).filter(Boolean))

    async function create(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await createIdea({ ...draft, content: draft.content.trim() || null })
        setSaving(false)
        if ('error' in res && res.error) return alert(res.error)
        setDraft({ title: '', content: '', category: 'General' })
        setModal(false)
        router.refresh()
    }
    async function move(id: string, s: IdeaItem['status']) {
        setIdeas(p => p.map(i => i.id === id ? { ...i, status: s } : i))
        await updateIdea(id, { status: s })
    }
    async function rate(id: string, patch: { impact?: number; effort?: number }) {
        setIdeas(p => p.map(i => i.id === id ? { ...i, ...patch } : i))
        await updateIdea(id, patch)
    }
    async function remove(id: string) {
        if (!confirm('¿Borrar esta idea? Esto sí la elimina.')) return
        setIdeas(p => p.filter(i => i.id !== id))
        await deleteIdea(id)
    }
    async function promote(id: string, to: 'task' | 'objective') {
        setBusy(id)
        const res: any = to === 'task' ? await promoteIdeaToTask(id) : await promoteIdeaToObjective(id, `Q${Math.floor(new Date().getMonth() / 3) + 1}` as any)
        setBusy(null)
        if (res?.error) return alert(res.error)
        setIdeas(p => p.map(i => i.id === id ? { ...i, status: 'promoted', promoted_to: to } as IdeaItem : i))
    }
    async function rescue(id: string) {
        setBusy(id)
        const res: any = await saveNoteAsIdea(id)
        setBusy(null)
        if (res?.error) return alert(res.error)
        router.refresh()
    }
    async function runReview() {
        setReviewing(true)
        setError('')
        const res = await reviewIdeaBank().catch(() => ({ ok: false as const, error: 'No pude contactar al servidor.' }))
        setReviewing(false)
        if (!res.ok) return setError(res.error)
        setReview(res.data)
    }
    async function applyScores() {
        setSaving(true)
        await applyIdeaScores(review.scored.map((s: any) => ({ id: s.id, impact: s.impact, effort: s.effort, category: s.category })))
        setSaving(false)
        setReview((r: any) => ({ ...r, scored: [] }))
        router.refresh()
    }

    const Actions = ({ i }: { i: IdeaItem }) => (
        <div className="flex flex-wrap items-center gap-1 -ml-2">
            {i.status !== 'promoted' && <>
                <button disabled={busy === i.id} onClick={() => promote(i.id, 'task')} className="h-9 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-raised inline-flex items-center gap-1.5">{busy === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />} A tarea</button>
                <button disabled={busy === i.id} onClick={() => promote(i.id, 'objective')} className="h-9 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-raised inline-flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> A objetivo</button>
            </>}
            {i.status === 'raw' && <button onClick={() => move(i.id, 'exploring')} title="Explorar" aria-label="Explorar" className="w-9 h-9 rounded-lg text-ink-faint hover:text-foreground flex items-center justify-center"><Compass className="w-4 h-4" /></button>}
            {i.status === 'archived' ? <button onClick={() => move(i.id, 'raw')} title="Devolver al banco" aria-label="Devolver al banco" className="w-9 h-9 rounded-lg text-ink-faint hover:text-foreground flex items-center justify-center"><RotateCcw className="w-4 h-4" /></button>
                : i.status !== 'promoted' && <button onClick={() => move(i.id, 'archived')} title="Archivar" aria-label="Archivar" className="w-9 h-9 rounded-lg text-ink-faint hover:text-foreground flex items-center justify-center"><Archive className="w-4 h-4" /></button>}
            <button onClick={() => remove(i.id)} title="Borrar" aria-label="Borrar" className="w-9 h-9 rounded-lg text-ink-faint hover:text-red-300 flex items-center justify-center ml-auto"><Trash2 className="w-4 h-4" /></button>
        </div>
    )
    const Rate = ({ i, k, label }: { i: IdeaItem; k: 'impact' | 'effort'; label: string }) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{label}
            <select aria-label={label} value={i[k] ?? ''} onChange={e => rate(i.id, { [k]: Number(e.target.value) })} className="bg-transparent font-mono text-foreground focus:outline-none cursor-pointer"><option value="" disabled>–</option>{[1, 2, 3, 4, 5].map(v => <option key={v} value={v} className="bg-popover">{v}</option>)}</select>
        </span>
    )

    return (
        <PageShell wide>
            <PageHeader label="Capturar · exploración" title="Banco de Ideas" subtitle="Hipótesis y chispas que esperan su momento, antes de comprometer tiempo o plata."
                actions={<><Segmented value={tab} onChange={setTab} options={[{ id: 'banco', label: 'Banco', count: open.length }, { id: 'archivo', label: 'Archivo de capturas', count: archivedNotes.length }]} /><button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Idea</button></>} />

            {tab === 'archivo' ? (
                <div className="max-w-[820px]">
                    <p className="text-sm text-muted-foreground mb-4">Todo lo que procesaste en el Inbox sigue acá. Podés rescatar cualquier captura como idea.</p>
                    {archivedNotes.length === 0 ? <EmptyState icon={Inbox} title="Todavía no procesaste capturas" /> : (
                        <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                            {archivedNotes.map(x => (
                                <div key={x.id} className="px-4 py-3 flex items-start gap-4">
                                    <div className="flex-1 min-w-0"><p className="text-sm whitespace-pre-wrap break-words">{x.content}</p><p className="font-mono text-[11px] text-ink-faint mt-1">{format(new Date(x.created_at), 'd MMM yyyy', { locale: es })}{x.processed_as ? ` · ${DEST[x.processed_as] || x.processed_as}` : ''}</p></div>
                                    <button onClick={() => rescue(x.id)} disabled={rescued.has(x.id) || busy === x.id} className="h-9 px-3 rounded-lg border border-hairline text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 shrink-0">{rescued.has(x.id) ? 'En el banco' : 'Rescatar'}</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Segmented value={status} onChange={setStatus} options={[{ id: 'open', label: 'Activas', count: open.length }, { id: 'exploring', label: 'Explorando', count: n('exploring') }, { id: 'promoted', label: 'Convertidas', count: n('promoted') }, { id: 'archived', label: 'Archivadas', count: n('archived') }]} />
                            <select value={category || ''} onChange={e => setCategory(e.target.value || null)} aria-label="Categoría" className="h-11 bg-card border border-hairline rounded-xl px-3 text-xs text-muted-foreground"><option value="">Todas las categorías</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
                            <select value={sort} onChange={e => setSort(e.target.value as any)} aria-label="Orden" className="h-11 bg-card border border-hairline rounded-xl px-3 text-xs text-muted-foreground"><option value="leverage">Mayor impacto</option><option value="recent">Más nuevas</option></select>
                        </div>
                        {visible.length === 0 ? <EmptyState icon={Lightbulb} title="Sin ideas acá" hint="Anotá una o mandá una captura del Inbox al banco." /> : (
                            <div className="sm:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
                                {visible.map((i, idx) => {
                                    const top = idx === 0 && status === 'open' && sort === 'leverage' && i.impact != null
                                    return (
                                        <article key={i.id} className={cn('rounded-2xl p-5', top ? 'lamp' : 'bg-card border border-hairline')}>
                                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="label-caps !text-[10px]">{i.category || 'General'}{status === 'open' && i.status === 'exploring' ? ' · explorando' : ''}</span><span className="font-mono">{formatDistanceToNow(new Date(i.created_at), { locale: es })}</span></div>
                                            <h2 className="text-[15px] font-semibold leading-snug mt-2">{i.title}</h2>
                                            {i.content && i.content !== i.title && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-5 whitespace-pre-wrap">{i.content}</p>}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-hairline"><Rate i={i} k="impact" label="Impacto" /><Rate i={i} k="effort" label="Esfuerzo" />{quadrant(i) && <span className={cn('ml-auto text-xs', quadrant(i) === 'Victoria rápida' ? 'text-emerald-300' : 'text-ink-faint')}>{quadrant(i)}</span>}</div>
                                            <div className="mt-2"><Actions i={i} /></div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <aside className="lg:col-span-4 space-y-4">
                        <Panel>
                            <SectionLabel right={`${scored.length} puntuadas`}>Impacto / esfuerzo</SectionLabel>
                            <div className="relative aspect-[4/3] rounded-xl border border-hairline bg-background/40">
                                <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-hairline" /><span className="absolute inset-x-0 top-1/2 border-t border-dashed border-hairline" />
                                <span className="absolute left-2 top-2 text-[10px] text-emerald-300">Victorias rápidas</span><span className="absolute right-2 top-2 text-[10px] text-ink-faint">Proyectos mayores</span>
                                {scored.map((i, k) => <span key={i.id} title={`${i.title} · impacto ${i.impact}, esfuerzo ${i.effort}`} className={cn('absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2', quadrant(i) === 'Victoria rápida' ? 'bg-emerald-400' : 'bg-graphite-300')} style={{ left: `${10 + ((i.effort! - 1) / 4) * 80 + (k % 3) * 2}%`, top: `${88 - ((i.impact! - 1) / 4) * 72 + (k % 2) * 2}%` }} />)}
                            </div>
                            <div className="flex justify-between text-[10px] text-ink-faint mt-1.5"><span>esfuerzo bajo</span><span>esfuerzo alto</span></div>
                            {quick.length > 0 && <p className="text-sm text-muted-foreground mt-3">{quick.length === 1 ? 'Hay una victoria rápida' : `Hay ${quick.length} victorias rápidas`}: mucho impacto con poco esfuerzo.</p>}
                        </Panel>
                        <Panel>
                            <SectionLabel>¿Cuál conviene empezar?</SectionLabel>
                            <p className="text-sm text-muted-foreground mb-3">La IA puntúa todas mirando tu situación y elige una sola.</p>
                            <button onClick={runReview} disabled={reviewing || !ideas.length} className="btn-secondary w-full text-sm">{reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />} Curar el banco</button>
                            {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
                            {review && <div className="mt-4 pt-4 border-t border-hairline space-y-4">
                                {review.summary && <p className="text-sm text-muted-foreground">{review.summary}</p>}
                                {review.top_pick && <div><p className="label-caps !text-amber-300">Empezá por esta</p><p className="text-sm font-medium mt-1">{review.top_pick.title}</p>{review.top_pick.why && <p className="text-sm text-muted-foreground mt-1">{review.top_pick.why}</p>}{review.top_pick.first_step && <p className="text-sm mt-1">Primer paso: {review.top_pick.first_step}</p>}</div>}
                                {review.scored?.length > 0 && <button onClick={applyScores} disabled={saving} className="btn-secondary w-full text-sm"><Check className="w-4 h-4" /> Guardar {review.scored.length} puntajes</button>}
                                {review.prune?.map((p: any) => <div key={p.id} className="flex gap-3 text-sm"><div className="flex-1"><p>{p.title}</p><p className="text-muted-foreground text-xs mt-0.5">{p.why}</p></div><button onClick={() => move(p.id, 'archived')} className="text-xs text-muted-foreground hover:text-foreground h-9">Soltar</button></div>)}
                            </div>}
                        </Panel>
                    </aside>
                </div>
            )}

            <Modal open={modal} title="Nueva idea" onClose={() => setModal(false)}>
                <form onSubmit={create} className="space-y-4">
                    <Field label="La idea, en una línea"><input required autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="field" /></Field>
                    <Field label="Desarrollo (opcional)"><textarea rows={5} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} className="field py-2.5 resize-none" /></Field>
                    <Field label="Categoría"><input list="idea-cats" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="field" /><datalist id="idea-cats">{['Trabajo', 'Personal', 'Contenido', ...categories].map(c => <option key={c} value={c} />)}</datalist></Field>
                    <button disabled={saving} className="btn-primary w-full text-sm">Guardar idea</button>
                </form>
            </Modal>
        </PageShell>
    )
}
