'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, Sparkles, Plus, Trash2, ChevronDown } from 'lucide-react'
import { NextStepPrompt } from '@/components/okrs/NextStepPrompt'
import { ObjectiveItem, KeyResult, createObjective, updateObjectiveProgress, deleteObjective, updateKeyResults } from '@/lib/actions/okrs'
import { DreamItem, createDream, deleteDream } from '@/lib/actions/dreams'
import { ObjectiveSuggester } from '@/components/okrs/ObjectiveSuggester'
import { objectiveProgress, krRatio } from '@/lib/keyResults'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState, Check } from '@/components/ui/kit'
import { Modal, Field, Segmented, Bar } from '@/components/ui/controls'
import { quarterInfo } from '@/lib/quarter'
import { cn } from '@/lib/utils'

type Timeframe = 'Year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
const quarterOf = () => Math.floor(new Date().getMonth() / 3) + 1
const DREAM_LABEL: Record<string, string> = { Personal: 'Personal', Professional: 'Profesional', Health: 'Salud', Financial: 'Financiero', Relationships: 'Relaciones', Adventure: 'Aventura' }

export function OKRsClient({ objectives: initialObjectives, linkedTasks, dreams: initialDreams }: {
    objectives: ObjectiveItem[]; linkedTasks: Record<string, any[]>; dreams: DreamItem[]
}) {
    const router = useRouter()
    const [objectives, setObjectives] = useState(initialObjectives)
    const [dreams, setDreams] = useState(initialDreams)
    const [tab, setTab] = useState<'All' | Timeframe>('All')
    const [openId, setOpenId] = useState<string | null>(initialObjectives.find(o => o.status === 'Active')?.id || null)
    const [objModal, setObjModal] = useState(false)
    const [dreamModal, setDreamModal] = useState(false)
    const [obj, setObj] = useState({ title: '', description: '', timeframe: `Q${quarterOf()}` as Timeframe, type: 'Personal', dream_id: '' })
    const [dream, setDream] = useState({ title: '', description: '', category: 'Personal' })

    useEffect(() => { setObjectives(initialObjectives); setDreams(initialDreams) }, [initialObjectives, initialDreams])

    const list = tab === 'All' ? objectives : objectives.filter(o => o.timeframe === tab)
    const active = objectives.filter(o => o.status === 'Active')
    const orphan = active.filter(o => !(linkedTasks[o.id] || []).some(t => t.status !== 'Done'))
    const now = new Date()
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const week = Math.min(13, Math.floor((now.getTime() - qStart.getTime()) / 604800000) + 1)
    const timePct = quarterInfo(now.getFullYear(), quarterOf()).elapsedPct
    const avg = active.length ? Math.round(active.reduce((a, o) => a + (o.progress_pct || 0), 0) / active.length) : 0

    /** Mover un resultado clave recalcula solo el avance del objetivo. */
    async function changeKR(o: ObjectiveItem, index: number, current: number) {
        const krs = [...(o.key_results || [])]
        if (!krs[index]) return
        krs[index] = { ...krs[index], start: krs[index].start ?? krs[index].current, current }
        const progress = objectiveProgress(krs, o.progress_pct)
        setObjectives(prev => prev.map(x => x.id === o.id ? { ...x, key_results: krs, progress_pct: progress, status: progress >= 100 ? 'Completed' : x.status } : x))
        await updateKeyResults(o.id, krs)
    }
    async function saveProgress(id: string, pct: number) {
        setObjectives(prev => prev.map(o => o.id === id ? { ...o, progress_pct: pct, status: pct >= 100 ? 'Completed' : 'Active' } : o))
        await updateObjectiveProgress(id, pct)
    }
    async function submitObjective(e: React.FormEvent) {
        e.preventDefault()
        const fd = new FormData()
        Object.entries(obj).forEach(([k, v]) => { if (v) fd.append(k, v) })
        await createObjective(fd)
        setObjModal(false)
        setObj(o => ({ ...o, title: '', description: '' }))
        router.refresh()
    }
    async function submitDream(e: React.FormEvent) {
        e.preventDefault()
        const fd = new FormData()
        Object.entries(dream).forEach(([k, v]) => fd.append(k, v))
        await createDream(fd)
        setDreamModal(false)
        setDream(d => ({ ...d, title: '', description: '' }))
        router.refresh()
    }
    async function removeObjective(id: string) {
        if (!confirm('¿Eliminar este objetivo?')) return
        await deleteObjective(id)
        setObjectives(prev => prev.filter(o => o.id !== id))
    }
    async function removeDream(id: string) {
        if (!confirm('¿Eliminar este sueño?')) return
        await deleteDream(id)
        setDreams(prev => prev.filter(d => d.id !== id))
    }

    return (
        <PageShell wide>
            <PageHeader
                label={`Q${quarterOf()} ${now.getFullYear()} · semana ${week} de 13`}
                title="Objetivos"
                subtitle="Los vectores que ordenan tus días. Si una tarea no empuja un objetivo, pensá si va."
                actions={<>
                    <button onClick={() => setDreamModal(true)} className="btn-secondary text-sm"><Sparkles className="w-4 h-4" /> Sueño</button>
                    <button onClick={() => setObjModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Objetivo</button>
                </>}
            />
            <div className="mb-8 -mt-2">
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground mb-1.5"><span>trimestre recorrido</span><span>{timePct}%</span></div>
                <Bar pct={timePct} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0 space-y-4">
                    <Segmented value={tab} onChange={setTab} options={[
                        { id: 'All', label: 'Todos', count: objectives.length }, { id: 'Q1', label: 'Q1' }, { id: 'Q2', label: 'Q2' }, { id: 'Q3', label: 'Q3' }, { id: 'Q4', label: 'Q4' }, { id: 'Year', label: 'Año' }
                    ]} />

                    {list.length === 0 ? (
                        <EmptyState icon={Target} title="Sin objetivos en este período" hint="Creá uno o pedile propuestas a la IA en la columna de la derecha." />
                    ) : list.map((o, n) => {
                        const tasks = linkedTasks[o.id] || []
                        const openTasks = tasks.filter(t => t.status !== 'Done')
                        const isOpen = openId === o.id
                        const linked = dreams.find(d => d.id === o.dream_id)
                        const done = o.status === 'Completed'
                        return (
                            <section key={o.id} className={cn('rounded-2xl', isOpen && !done ? 'lamp' : 'bg-card border border-hairline')}>
                                <button onClick={() => setOpenId(isOpen ? null : o.id)} aria-expanded={isOpen} className="w-full text-left px-5 py-4">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="label-caps !text-[10px]">{o.type === 'Professional' ? 'Profesional' : 'Personal'}</span>
                                        <span className="font-mono">{o.timeframe === 'Year' ? 'Anual' : o.timeframe}{o.year ? ` ${o.year}` : ''}</span>
                                        {done ? <span className="text-emerald-300">cumplido</span> : openTasks.length === 0 && <span className="text-red-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> sin tareas abiertas</span>}
                                        <span className="ml-auto font-mono">{openTasks.length} abiertas · {tasks.length - openTasks.length} hechas</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="font-mono text-xs text-ink-faint">{String(n + 1).padStart(2, '0')}</span>
                                        <h2 className="flex-1 min-w-0 text-base font-semibold leading-snug">{o.title}</h2>
                                        <span className="font-mono text-sm">{o.progress_pct || 0}%</span>
                                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                                    </div>
                                    <Bar pct={o.progress_pct} tone={done ? 'good' : isOpen ? 'amber' : 'neutral'} className="mt-3" />
                                </button>

                                {isOpen && (
                                    <div className="px-5 pb-5 space-y-5">
                                        {o.description && <p className="text-sm text-muted-foreground max-w-[65ch]">{o.description}</p>}
                                        {linked && <p className="text-sm text-muted-foreground">Acerca al sueño: <span className="text-foreground">{linked.title}</span></p>}
                                        {!done && openTasks.length === 0 && <NextStepPrompt objectiveId={o.id} />}

                                        {(o.key_results?.length ?? 0) > 0 ? (
                                            <div>
                                                <SectionLabel>Resultados clave</SectionLabel>
                                                <div className="rounded-xl border border-hairline divide-y divide-hairline bg-background/30">
                                                    {(o.key_results || []).map((kr: KeyResult, i: number) => {
                                                        const pct = Math.round(krRatio(kr) * 100)
                                                        return (
                                                            <div key={i} className="px-4 py-3">
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <span className="flex-1 min-w-[160px] text-sm">{kr.title}</span>
                                                                    <input type="number" aria-label={`Valor actual de ${kr.title}`} value={kr.current} onChange={e => changeKR(o, i, Number(e.target.value) || 0)} className="field !min-h-9 !w-20 !px-2 font-mono text-right" />
                                                                    <span className="font-mono text-xs text-muted-foreground">/ {kr.target} {kr.unit}</span>
                                                                    <span className="font-mono text-xs w-10 text-right">{pct}%</span>
                                                                </div>
                                                                <Bar pct={pct} tone={pct >= 100 ? 'good' : 'neutral'} className="mt-2" />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <SectionLabel right={`${o.progress_pct || 0}%`}>Avance</SectionLabel>
                                                <input type="range" min={0} max={100} value={o.progress_pct || 0} aria-label="Avance del objetivo"
                                                    onChange={e => setObjectives(p => p.map(x => x.id === o.id ? { ...x, progress_pct: Number(e.target.value) } : x))}
                                                    onPointerUp={e => saveProgress(o.id, Number((e.target as HTMLInputElement).value))}
                                                    onKeyUp={e => saveProgress(o.id, Number((e.target as HTMLInputElement).value))}
                                                    className="w-full accent-amber-400" />
                                            </div>
                                        )}

                                        {tasks.length > 0 && (
                                            <div>
                                                <SectionLabel>Tareas vinculadas</SectionLabel>
                                                <div className="divide-y divide-hairline">
                                                    {[...openTasks, ...tasks.filter(t => t.status === 'Done')].slice(0, 6).map(t => (
                                                        <div key={t.id} className="flex items-center gap-3 min-h-[40px] text-sm">
                                                            <Check done={t.status === 'Done'} /><span className={cn('truncate', t.status === 'Done' && 'line-through text-muted-foreground')}>{t.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <button onClick={() => removeObjective(o.id)} className="text-xs text-muted-foreground hover:text-red-300 inline-flex items-center gap-1.5 min-h-[36px]"><Trash2 className="w-3.5 h-3.5" /> Eliminar objetivo</button>
                                    </div>
                                )}
                            </section>
                        )
                    })}
                </div>

                <aside className="lg:col-span-4 min-w-0 space-y-4">
                    <Panel>
                        <SectionLabel>Salud del trimestre</SectionLabel>
                        <dl className="text-sm divide-y divide-hairline">
                            <div className="flex justify-between py-2.5"><dt className="text-muted-foreground">Con tareas en marcha</dt><dd className="font-mono">{active.length - orphan.length} de {active.length}</dd></div>
                            <div className="flex justify-between py-2.5"><dt className="text-muted-foreground">Estancados</dt><dd className={cn('font-mono', orphan.length > 0 && 'text-red-300')}>{orphan.length}</dd></div>
                            <div className="flex justify-between py-2.5"><dt className="text-muted-foreground">Tiempo / avance</dt><dd className="font-mono">{timePct}% / {avg}%</dd></div>
                        </dl>
                    </Panel>
                    <Panel>
                        <SectionLabel right={dreams.length}>Sueños</SectionLabel>
                        {dreams.length === 0 ? <p className="text-sm text-muted-foreground">El norte que no cambia de un trimestre a otro. Anotá el primero.</p> : (
                            <ol className="divide-y divide-hairline">
                                {dreams.map((d, i) => (
                                    <li key={d.id} className="flex gap-3 py-3">
                                        <span className="font-mono text-xs text-ink-faint pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                                        <div className="flex-1 min-w-0"><p className="text-sm">{d.title}</p><p className="text-xs text-muted-foreground mt-0.5">{DREAM_LABEL[d.category || ''] || d.category}{d.target_year ? ` · ${d.target_year}` : ''}</p></div>
                                        <button onClick={() => removeDream(d.id)} aria-label="Eliminar sueño" className="w-8 h-8 text-ink-faint hover:text-red-300 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                    <ObjectiveSuggester />
                </aside>
            </div>

            <Modal open={objModal} title="Nuevo objetivo" onClose={() => setObjModal(false)}>
                <form onSubmit={submitObjective} className="space-y-4">
                    <Field label="Título"><input required value={obj.title} onChange={e => setObj({ ...obj, title: e.target.value })} placeholder="Conseguir el primer cliente de automatización" className="field" /></Field>
                    <Field label="Descripción"><textarea rows={2} value={obj.description} onChange={e => setObj({ ...obj, description: e.target.value })} className="field py-2.5 resize-none" /></Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Período"><select value={obj.timeframe} onChange={e => setObj({ ...obj, timeframe: e.target.value as Timeframe })} className="field"><option value="Q1">Q1 (ene-mar)</option><option value="Q2">Q2 (abr-jun)</option><option value="Q3">Q3 (jul-sep)</option><option value="Q4">Q4 (oct-dic)</option><option value="Year">Anual</option></select></Field>
                        <Field label="Tipo"><select value={obj.type} onChange={e => setObj({ ...obj, type: e.target.value })} className="field"><option value="Personal">Personal</option><option value="Professional">Profesional</option></select></Field>
                    </div>
                    <Field label="Sueño (opcional)"><select value={obj.dream_id} onChange={e => setObj({ ...obj, dream_id: e.target.value })} className="field"><option value="">Sin vincular</option>{dreams.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
                    <button className="btn-primary w-full text-sm">Crear objetivo</button>
                </form>
            </Modal>
            <Modal open={dreamModal} title="Nuevo sueño" onClose={() => setDreamModal(false)}>
                <form onSubmit={submitDream} className="space-y-4">
                    <Field label="Título"><input required value={dream.title} onChange={e => setDream({ ...dream, title: e.target.value })} className="field" /></Field>
                    <Field label="Categoría"><select value={dream.category} onChange={e => setDream({ ...dream, category: e.target.value })} className="field">{Object.entries(DREAM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                    <Field label="¿Por qué es importante?"><textarea rows={3} value={dream.description} onChange={e => setDream({ ...dream, description: e.target.value })} className="field py-2.5 resize-none" /></Field>
                    <button className="btn-primary w-full text-sm">Guardar sueño</button>
                </form>
            </Modal>
        </PageShell>
    )
}
