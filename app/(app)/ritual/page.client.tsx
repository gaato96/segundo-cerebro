'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Inbox, Target, CalendarClock, ArrowRight, ArrowLeft, Check as CheckIcon, Loader2, Wand2,
    AlertTriangle, Plus, RefreshCw, ChevronDown, X, Focus, CornerDownLeft
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    saveRitualLog, saveRitualDraft, suggestMorningPlan, planTasksForDay, createTaskForDay, setTaskBlocks,
    type MorningRitualLog
} from '@/lib/actions/morning_ritual'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { InboxTriage } from '@/components/plan/InboxTriage'
import { PageShell, PageHeader, SectionLabel, Panel, Check } from '@/components/ui/kit'
import { parseQuick } from '@/lib/nlParse'
import { cn, getPriorityLabel } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
    existingLog: MorningRitualLog | null
    morningData: any
    /** Las tareas del plan guardado, incluidas las ya hechas (para el resumen). */
    planTasks: any[]
    todayStr: string
}

const MAX_FOCUS = 3
const DAY_START = 8 * 60
const DAY_END = 22 * 60
const DURATIONS = [30, 45, 60, 90, 120]

const STEPS = [
    { id: 'inbox', label: 'Vaciar Inbox', icon: Inbox },
    { id: 'focus', label: 'Elegir foco', icon: Target },
    { id: 'day', label: 'Tu día', icon: CalendarClock }
] as const

type Block = { start: string | null; minutes: number }

const toMin = (t?: string | null) => {
    if (!t) return null
    const [h, m] = String(t).split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function nowMinutes() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    const [h, m] = p.split(':').map(Number)
    return h * 60 + m
}

/** Huecos libres entre eventos, desde ahora (o las 8) hasta las 22. */
function freeSlots(events: any[], taken: { start: number; end: number }[] = []) {
    const busy = [
        ...events.filter(e => !e.is_all_day && e.start_time).map(e => {
            const s = toMin(e.start_time)!
            return { start: s, end: toMin(e.end_time) ?? s + 60 }
        }),
        ...taken
    ].sort((a, b) => a.start - b.start)
    const from = Math.max(DAY_START, Math.ceil(nowMinutes() / 15) * 15)
    const slots: { start: number; end: number }[] = []
    let cursor = from
    for (const b of busy) {
        if (b.start > cursor) slots.push({ start: cursor, end: b.start })
        cursor = Math.max(cursor, b.end)
    }
    if (cursor < DAY_END) slots.push({ start: cursor, end: DAY_END })
    return slots.filter(s => s.end - s.start >= 15)
}

/**
 * Planificar el día.
 * 1. Vaciar el Inbox (ahí se anota todo durante el día).
 * 2. Elegir hasta 3 tareas viendo objetivos y hábitos.
 * 3. Ponerle hora a cada una en los huecos libres y arrancar.
 */
export function RitualClient({ existingLog, morningData, planTasks, todayStr }: Props) {
    const router = useRouter()
    const isCompleted = !!existingLog?.completed_at && (!!existingLog?.daily_objective || planTasks.length > 0)
    const openIds = new Set((morningData?.tasks || []).map((t: any) => t.id))
    const inboxNotes: any[] = morningData?.inboxNotes || []

    const [editing, setEditing] = useState(!isCompleted)
    const [step, setStep] = useState(inboxNotes.length ? 0 : 1)
    const [focusText, setFocusText] = useState(existingLog?.daily_objective || '')
    const [selected, setSelected] = useState<string[]>((existingLog?.mit_task_ids || []).filter(id => openIds.has(id)))
    const [extraTasks, setExtraTasks] = useState<any[]>([])
    const [statusOverride, setStatusOverride] = useState<Record<string, string>>({})
    const [blocks, setBlocks] = useState<Record<string, Block>>({})
    const [saving, setSaving] = useState(false)
    const [saveWarning, setSaveWarning] = useState('')
    const [log, setLog] = useState<MorningRitualLog | null>(existingLog)

    const [planning, setPlanning] = useState(false)
    const [planError, setPlanError] = useState('')
    const [plan, setPlan] = useState<any>(null)

    const tasks: any[] = useMemo(() => {
        const open: any[] = morningData?.tasks || []
        const ids = new Set(open.map(t => t.id))
        const fromPlan = planTasks.filter(t => !ids.has(t.id))
        fromPlan.forEach(t => ids.add(t.id))
        return [...open, ...fromPlan, ...extraTasks.filter(t => !ids.has(t.id))]
            .map(t => (statusOverride[t.id] ? { ...t, status: statusOverride[t.id] } : t))
    }, [morningData?.tasks, planTasks, extraTasks, statusOverride])

    const objectives: any[] = morningData?.objectives || []
    const habits: any[] = morningData?.habits || []
    const events: any[] = morningData?.events || []
    const objTitle = useMemo(() => new Map(objectives.map(o => [o.id, o.title])), [objectives])
    const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])
    const selectedTasks = selected.map(id => taskById.get(id)).filter(Boolean) as any[]
    const effectiveFocus = focusText.trim() || selectedTasks[0]?.title || ''
    const summaryTasks = (log?.mit_task_ids || []).map(id => taskById.get(id)).filter(Boolean) as any[]

    // Al llegar al paso 3, cada tarea sin hora recibe el primer hueco libre.
    useEffect(() => {
        if (step !== 2) return
        setBlocks(prev => {
            const next: Record<string, Block> = {}
            const taken: { start: number; end: number }[] = []
            for (const t of selectedTasks) {
                const existing = prev[t.id] || (t.block_start ? { start: String(t.block_start).slice(0, 5), minutes: t.estimated_minutes || 60 } : null)
                if (existing?.start) {
                    next[t.id] = existing
                    const s = toMin(existing.start)!
                    taken.push({ start: s, end: s + existing.minutes })
                }
            }
            for (const t of selectedTasks) {
                if (next[t.id]) continue
                const minutes = prev[t.id]?.minutes || t.estimated_minutes || 60
                const slot = freeSlots(events, taken).find(s => s.end - s.start >= Math.min(minutes, 30))
                const start = slot ? slot.start : null
                next[t.id] = { start: start !== null ? hhmm(start) : null, minutes }
                if (start !== null) taken.push({ start, end: start + minutes })
            }
            return next
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step])

    function toggle(id: string) {
        setSelected(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id)
            if (prev.length >= MAX_FOCUS) return prev
            return [...prev, id]
        })
    }

    function goTo(i: number) {
        saveRitualDraft(todayStr, focusText, undefined, selected)
        if (step === 0 && i > 0) router.refresh()
        setStep(i)
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function handleSuggest() {
        setPlanning(true)
        setPlanError('')
        try {
            const res = await suggestMorningPlan(todayStr, focusText)
            if (!res.ok) return setPlanError(res.error)
            setPlan(res.data)
            setSelected(res.data.mit_task_ids.slice(0, MAX_FOCUS))
            if (!focusText.trim()) setFocusText(res.data.daily_objective)
        } catch (e: any) {
            setPlanError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setPlanning(false)
        }
    }

    async function handleFinish() {
        setSaving(true)
        setSaveWarning('')
        const ids = selectedTasks.map(t => t.id)
        const [res] = await Promise.all([
            saveRitualLog(todayStr, effectiveFocus, undefined, ids),
            planTasksForDay(ids, todayStr)
        ])
        const blockRes = await setTaskBlocks(ids.map(id => ({ id, start: blocks[id]?.start || null, minutes: blocks[id]?.minutes || null })))
        setSaving(false)
        if (res.error) return alert(res.error)
        if (blockRes.error) setSaveWarning(blockRes.error)
        if (res.log) setLog(res.log)
        setEditing(false)
        import('canvas-confetti').then(c => c.default({ particleCount: 70, spread: 65, colors: ['#E0A54B', '#6FAE8C', '#EDEDEF'], origin: { y: 0.5 } }))
        router.refresh()
    }

    async function toggleDone(task: any) {
        const next = task.status === 'Done' ? 'Todo' : 'Done'
        setStatusOverride(s => ({ ...s, [task.id]: next }))
        await updateTaskStatus(task.id, next)
    }

    const label = format(new Date(`${todayStr}T12:00:00`), "EEEE d/MM", { locale: es })

    return (
        <PageShell>
            <PageHeader
                label={label}
                title="Planificar el día"
                subtitle="Vaciá el Inbox, elegí el foco y ponele hora."
                actions={!editing ? (
                    <button onClick={() => { setEditing(true); setStep(inboxNotes.length ? 0 : 1) }} className="btn-secondary text-sm">
                        <RefreshCw className="w-4 h-4" /> Replanificar
                    </button>
                ) : (
                    <nav className="flex items-center gap-1 p-1 rounded-xl bg-card border border-hairline">
                        {STEPS.map((s, i) => {
                            const active = i === step
                            const done = i < step
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => goTo(i)}
                                    className={cn(
                                        'h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors',
                                        active ? 'bg-raised text-amber-300' : done ? 'text-muted-foreground' : 'text-ink-faint hover:text-foreground'
                                    )}
                                >
                                    {done ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <span className="font-mono">{i + 1}</span>}
                                    <span className={cn(!active && 'hidden sm:inline', done && 'line-through decoration-hairline')}>{s.label}</span>
                                    {s.id === 'inbox' && inboxNotes.length > 0 && <span className="font-mono text-[10px] text-muted-foreground">{inboxNotes.length}</span>}
                                </button>
                            )
                        })}
                    </nav>
                )}
            />

            {saveWarning && (
                <p className="mb-5 text-xs text-amber-200 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> {saveWarning}
                </p>
            )}

            {!editing && log?.completed_at && (log.daily_objective || summaryTasks.length > 0) ? (
                <DaySummary
                    focus={log.daily_objective || ''}
                    tasks={summaryTasks}
                    events={events}
                    habits={habits}
                    objTitle={objTitle}
                    pendingInbox={inboxNotes.length}
                    onToggle={toggleDone}
                />
            ) : (
                <>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="min-w-0"
                        >
                            {step === 0 && (
                                <div className="grid lg:grid-cols-12 gap-8">
                                    <div className="lg:col-span-8 min-w-0">
                                        <InboxTriage notes={inboxNotes} dateStr={todayStr} />
                                    </div>
                                    <aside className="lg:col-span-4 space-y-4">
                                        <Panel>
                                            <SectionLabel>Dónde va cada cosa</SectionLabel>
                                            <dl className="space-y-2.5 text-sm">
                                                {[
                                                    ['Hecho', 'Ya lo resolviste. Sale sin crear nada.'],
                                                    ['Hoy', 'Tarea planificada para hoy.'],
                                                    ['Tarea', 'Va a Tareas, sin fecha.'],
                                                    ['Evento', 'Tiene día y hora: a la agenda.'],
                                                    ['Idea', 'Algo para algún día: Banco de Ideas.'],
                                                    ['Archivar', 'Referencia o ruido. Queda en el archivo.']
                                                ].map(([k, v]) => (
                                                    <div key={k} className="flex gap-3">
                                                        <dt className="w-16 shrink-0 font-medium">{k}</dt>
                                                        <dd className="text-muted-foreground">{v}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                            <p className="hidden md:block font-mono text-[10px] text-ink-faint mt-4">Teclas: D H T E I A</p>
                                        </Panel>
                                    </aside>
                                </div>
                            )}

                            {step === 1 && (
                                <FocusStep
                                    todayStr={todayStr}
                                    tasks={tasks}
                                    objectives={objectives}
                                    habits={habits}
                                    events={events}
                                    objTitle={objTitle}
                                    selected={selected}
                                    focusText={focusText}
                                    setFocusText={setFocusText}
                                    onToggle={toggle}
                                    onCreated={(task, time) => {
                                        setExtraTasks(prev => [...prev, task])
                                        setSelected(prev => prev.length < MAX_FOCUS ? [...prev, task.id] : prev)
                                        if (time) setBlocks(b => ({ ...b, [task.id]: { start: time, minutes: 60 } }))
                                    }}
                                    planning={planning}
                                    planError={planError}
                                    plan={plan}
                                    onSuggest={handleSuggest}
                                />
                            )}

                            {step === 2 && (
                                <DayStep
                                    focus={effectiveFocus}
                                    tasks={selectedTasks}
                                    events={events}
                                    habits={habits}
                                    blocks={blocks}
                                    setBlock={(id, b) => setBlocks(prev => ({ ...prev, [id]: { ...prev[id], ...b } }))}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div className="sticky bottom-[84px] md:bottom-4 z-20 mt-8">
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-card/95 backdrop-blur border border-hairline p-2.5">
                            <button
                                onClick={() => goTo(Math.max(0, step - 1))}
                                disabled={step === 0}
                                className="h-10 px-3 rounded-xl text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Anterior
                            </button>
                            <span className="hidden sm:block font-mono text-[11px] text-muted-foreground">
                                Paso {step + 1} de 3{step === 1 ? ` · ${selected.length}/${MAX_FOCUS} elegidas` : ''}
                            </span>
                            {step < STEPS.length - 1 ? (
                                <button onClick={() => goTo(step + 1)} className="btn-primary text-sm">
                                    {step === 0 ? 'Elegir el foco' : 'Ver el día'} <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={handleFinish} disabled={saving || !selectedTasks.length} className="btn-primary text-sm">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                                    Arrancar el día
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </PageShell>
    )
}

// ------------------------------------------------------------

function FocusStep(props: {
    todayStr: string
    tasks: any[]
    objectives: any[]
    habits: any[]
    events: any[]
    objTitle: Map<string, string>
    selected: string[]
    focusText: string
    setFocusText: (v: string) => void
    onToggle: (id: string) => void
    onCreated: (task: any, time: string | null) => void
    planning: boolean
    planError: string
    plan: any
    onSuggest: () => void
}) {
    const { todayStr, tasks, objectives, habits, events, objTitle, selected, onToggle } = props
    const [newTask, setNewTask] = useState('')
    const [creating, setCreating] = useState(false)
    const [showAll, setShowAll] = useState(false)

    const activeObjIds = new Set(objectives.map(o => o.id))
    const open = tasks.filter(t => t.status !== 'Done')
    const isToday = (t: any) => t.planned_date === todayStr || (t.due_date && String(t.due_date).slice(0, 10) <= todayStr)
    const forToday = open.filter(isToday)
    const forGoals = open.filter(t => !isToday(t) && t.objective_id && activeObjIds.has(t.objective_id))
    const rest = open.filter(t => !isToday(t) && !(t.objective_id && activeObjIds.has(t.objective_id)))
    const restShown = showAll ? rest : rest.slice(0, 6)

    // Objetivos activos sin ninguna tarea abierta: no avanzan solos.
    const goalsWithTasks = new Set(open.map(t => t.objective_id).filter(Boolean))
    const orphanGoals = objectives.filter(o => !goalsWithTasks.has(o.id))

    const parsed = newTask.trim() ? parseQuick(newTask, todayStr) : null

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        if (!parsed) return
        setCreating(true)
        const res = await createTaskForDay(parsed.title, todayStr)
        setCreating(false)
        if (res.error || !res.task) return alert(res.error || 'No se pudo crear.')
        props.onCreated(res.task, parsed.time)
        setNewTask('')
    }

    const timedEvents = events.filter(e => !e.is_all_day && e.start_time)

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                    <label htmlFor="focus-line" className="label-caps">Foco del día</label>
                    <span className="text-xs text-muted-foreground hidden sm:inline">Si lo dejás vacío, el foco es tu primera tarea</span>
                </div>
                <input
                    id="focus-line"
                    value={props.focusText}
                    onChange={e => props.setFocusText(e.target.value)}
                    placeholder={selected.length ? tasks.find(t => t.id === selected[0])?.title : 'Ej: Cerrar la propuesta para el primer cliente'}
                    className="field !min-h-[52px] text-base"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <Panel className="md:col-span-7 min-w-0">
                    <SectionLabel right={objectives.length ? `${objectives.length} activos` : undefined}>Tus objetivos</SectionLabel>
                    {objectives.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin objetivos activos. <Link href="/okrs" className="underline underline-offset-4">Definí uno</Link>.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {objectives.slice(0, 5).map(o => (
                                <div key={o.id} className="flex items-center gap-3 text-sm">
                                    <span className="flex-1 min-w-0 truncate">{o.title}</span>
                                    {!goalsWithTasks.has(o.id) && <span className="text-[10px] text-red-300 shrink-0">sin tareas</span>}
                                    <span className="w-16 h-1 rounded-full bg-raised overflow-hidden shrink-0">
                                        <span className="block h-full bg-graphite-300" style={{ width: `${Math.min(100, o.progress_pct || 0)}%` }} />
                                    </span>
                                    <span className="font-mono text-[11px] text-muted-foreground w-9 text-right shrink-0">{o.progress_pct || 0}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
                <Panel className="md:col-span-5 min-w-0">
                    <SectionLabel right={`${habits.filter(h => h.done_today).length}/${habits.length} hechos`}>Hábitos de hoy</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                        {habits.map(h => (
                            <span key={h.id} className={cn('text-xs px-2.5 h-7 inline-flex items-center rounded-lg border border-hairline max-w-full truncate',
                                h.done_today ? 'text-emerald-300 line-through' : 'text-foreground/85')}>
                                {h.title}
                            </span>
                        ))}
                        {habits.length === 0 && <span className="text-sm text-muted-foreground">Ninguno hoy.</span>}
                    </div>
                    {timedEvents.length > 0 && (
                        <p className="font-mono text-[11px] text-muted-foreground mt-4 pt-3 border-t border-hairline">
                            {timedEvents.length} {timedEvents.length === 1 ? 'evento' : 'eventos'} con hora ({timedEvents.map(e => String(e.start_time).slice(0, 5)).join(', ')})
                        </p>
                    )}
                </Panel>
            </div>

            {orphanGoals.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-3 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                    <p className="text-foreground/90">
                        {orphanGoals.length === 1 ? 'Un objetivo no tiene' : `${orphanGoals.length} objetivos no tienen`} ninguna tarea abierta:{' '}
                        <span className="text-muted-foreground">{orphanGoals.map(o => o.title).join(' · ')}</span>.{' '}
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-capture', { detail: { kind: 'task' } }))}
                            className="underline underline-offset-4 decoration-hairline hover:text-foreground"
                        >
                            Creá el próximo paso
                        </button>.
                    </p>
                </div>
            )}

            {/* Elegidas */}
            <section>
                <SectionLabel right={`${selected.length}/${MAX_FOCUS}`}>Elegidas</SectionLabel>
                {selected.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-hairline px-4 py-4">Tocá tareas de abajo para elegirlas. La primera es la que hace que el día valga la pena.</p>
                ) : (
                    <div className="space-y-2">
                        {selected.map((id, i) => {
                            const t = tasks.find(x => x.id === id)
                            if (!t) return null
                            return (
                                <div key={id} className={cn('flex items-center gap-3 px-3.5 min-h-[52px] py-2 rounded-xl', i === 0 ? 'lamp' : 'bg-card border border-hairline')}>
                                    <span className={cn('font-mono text-xs w-5 h-5 rounded-md flex items-center justify-center shrink-0', i === 0 ? 'bg-amber-400 text-background' : 'bg-raised text-muted-foreground')}>{i + 1}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-medium leading-snug line-clamp-2">{t.title}</span>
                                        {t.objective_id && objTitle.get(t.objective_id) && <span className="block text-xs text-muted-foreground truncate">→ {objTitle.get(t.objective_id)}</span>}
                                    </span>
                                    <button onClick={() => onToggle(id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Quitar">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
                    <button onClick={props.onSuggest} disabled={props.planning || !open.length} className="btn-secondary text-sm">
                        {props.planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-amber-400" />}
                        {props.planning ? 'Mirando tus tareas y objetivos…' : props.focusText.trim() ? 'Que la IA elija para este foco' : 'Que la IA elija entre mis tareas'}
                    </button>
                    {props.plan?.reasoning && <p className="text-xs text-muted-foreground italic">{props.plan.reasoning}</p>}
                </div>
                {props.planError && <p className="text-xs text-red-300 mt-2">{props.planError}</p>}
                {props.plan?.warning && (
                    <p className="text-xs text-amber-200 mt-2 flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> {props.plan.warning}</p>
                )}
            </section>

            {/* Pool */}
            <section className="space-y-5">
                <TaskGroup title="Para hoy o vencidas" dot="bg-red-400" tasks={forToday} {...{ selected, onToggle, objTitle, todayStr }} empty="Nada planificado ni vencido para hoy." />
                {forGoals.length > 0 && <TaskGroup title="Empujan un objetivo" dot="bg-amber-400" tasks={forGoals} {...{ selected, onToggle, objTitle, todayStr }} />}
                {rest.length > 0 && (
                    <div>
                        <TaskGroup title={`El resto · ${rest.length}`} tasks={restShown} {...{ selected, onToggle, objTitle, todayStr }} />
                        {rest.length > 6 && (
                            <button onClick={() => setShowAll(v => !v)} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAll && 'rotate-180')} />
                                {showAll ? 'Ver menos' : `Ver las ${rest.length} tareas`}
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleCreate} className="space-y-1.5">
                    <div className="relative">
                        <input
                            value={newTask}
                            onChange={e => setNewTask(e.target.value)}
                            placeholder="¿No está en la lista? Agregá una tarea (ej: llamar al contador 10hs)"
                            className="field pr-12"
                        />
                        <button type="submit" disabled={creating || !parsed} aria-label="Agregar" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40">
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CornerDownLeft className="w-4 h-4" />}
                        </button>
                    </div>
                    {parsed && parsed.summary.length > 0 && (
                        <p className="text-xs text-muted-foreground px-1">
                            Entendí: <span className="text-foreground">{parsed.title}</span> · <span className="font-mono">{parsed.summary.join(' · ')}</span>
                        </p>
                    )}
                </form>
            </section>
        </div>
    )
}

function TaskGroup({ title, tasks, selected, onToggle, objTitle, empty, dot, todayStr }: {
    title: string
    tasks: any[]
    selected: string[]
    onToggle: (id: string) => void
    objTitle: Map<string, string>
    empty?: string
    dot?: string
    todayStr: string
}) {
    return (
        <div>
            <p className="label-caps mb-2 flex items-center gap-2">
                {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
                {title}
            </p>
            {tasks.length === 0 && empty ? (
                <p className="text-sm text-muted-foreground">{empty}</p>
            ) : (
                <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                    {tasks.map(t => {
                        const idx = selected.indexOf(t.id)
                        const isSel = idx >= 0
                        const full = !isSel && selected.length >= MAX_FOCUS
                        const due = t.due_date ? String(t.due_date).slice(0, 10) : null
                        const overdue = due && due < todayStr
                        return (
                            <button
                                key={t.id}
                                onClick={() => onToggle(t.id)}
                                disabled={full}
                                className={cn(
                                    'w-full text-left flex items-center gap-3 px-3.5 min-h-[52px] py-2 transition-colors first:rounded-t-2xl last:rounded-b-2xl',
                                    isSel ? 'bg-amber-400/5' : 'hover:bg-raised/50',
                                    full && 'opacity-40 cursor-not-allowed'
                                )}
                            >
                                <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center font-mono text-[10px] shrink-0',
                                    isSel ? 'bg-amber-400 border-amber-400 text-background' : 'border-[hsl(var(--hairline-strong))]')}>
                                    {isSel ? idx + 1 : ''}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm leading-snug line-clamp-2">{t.title}</span>
                                    {t.objective_id && objTitle.get(t.objective_id) && <span className="block text-xs text-muted-foreground truncate">→ {objTitle.get(t.objective_id)}</span>}
                                </span>
                                <span className="hidden sm:inline font-mono text-[10px] uppercase text-muted-foreground shrink-0">{getPriorityLabel(t.priority)}</span>
                                {due && (
                                    <span className={cn('font-mono text-[11px] shrink-0', overdue ? 'text-red-300' : 'text-muted-foreground')}>
                                        {due.slice(8, 10)}/{due.slice(5, 7)}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/** Paso 3: bloques de tiempo en los huecos libres, con la agenda al lado. */
function DayStep({ focus, tasks, events, habits, blocks, setBlock }: {
    focus: string
    tasks: any[]
    events: any[]
    habits: any[]
    blocks: Record<string, Block>
    setBlock: (id: string, b: Partial<Block>) => void
}) {
    const timeline = useMemo(() => {
        const items: { key: string; start: number; end: number; title: string; kind: 'event' | 'task'; idx?: number }[] = []
        for (const e of events) {
            const s = toMin(e.start_time)
            if (s === null || e.is_all_day) continue
            items.push({ key: `e-${e.id}`, start: s, end: toMin(e.end_time) ?? s + 60, title: e.title, kind: 'event' })
        }
        tasks.forEach((t, i) => {
            const b = blocks[t.id]
            const s = toMin(b?.start)
            if (s === null) return
            items.push({ key: `t-${t.id}`, start: s, end: s + (b?.minutes || 60), title: t.title, kind: 'task', idx: i })
        })
        return items.sort((a, b) => a.start - b.start)
    }, [events, tasks, blocks])

    const overlaps = new Set<string>()
    for (let i = 0; i < timeline.length; i++) {
        for (let j = i + 1; j < timeline.length; j++) {
            if (timeline[j].start < timeline[i].end) { overlaps.add(timeline[i].key); overlaps.add(timeline[j].key) }
        }
    }

    const taskMinutes = tasks.reduce((s, t) => s + (blocks[t.id]?.minutes || 60), 0)
    const free = freeSlots(events).reduce((s, x) => s + (x.end - x.start), 0)
    const overbooked = taskMinutes > free
    const allDay = events.filter(e => e.is_all_day || !e.start_time)

    return (
        <div className="space-y-6">
            <div className="lamp rounded-2xl px-5 py-4">
                <p className="label-caps !text-amber-300/90">Foco</p>
                <p className="text-lg font-semibold mt-0.5">{focus || 'Elegí al menos una tarea'}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-5 min-w-0">
                    <SectionLabel right={`${Math.round(taskMinutes / 6) / 10} h`}>Ponele hora</SectionLabel>
                    <div className="space-y-2.5">
                        {tasks.map((t, i) => {
                            const b = blocks[t.id] || { start: null, minutes: 60 }
                            return (
                                <div key={t.id} className={cn('rounded-xl p-3.5 space-y-3', i === 0 ? 'lamp' : 'bg-card border border-hairline')}>
                                    <div className="flex items-start gap-2.5">
                                        <span className={cn('font-mono text-xs w-5 h-5 rounded-md flex items-center justify-center shrink-0', i === 0 ? 'bg-amber-400 text-background' : 'bg-raised text-muted-foreground')}>{i + 1}</span>
                                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="time"
                                            value={b.start || ''}
                                            onChange={e => setBlock(t.id, { start: e.target.value || null })}
                                            className="field !min-h-9 h-9 !w-[112px] font-mono text-sm"
                                            aria-label="Hora de inicio"
                                        />
                                        <div className="flex gap-1">
                                            {DURATIONS.map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setBlock(t.id, { minutes: m })}
                                                    className={cn('h-9 px-2.5 rounded-lg border font-mono text-[11px] transition-colors',
                                                        b.minutes === m ? 'border-amber-400/50 text-amber-300 bg-amber-400/10' : 'border-hairline text-muted-foreground hover:text-foreground')}
                                                >
                                                    {m < 60 ? `${m}m` : `${m / 60}h`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {overbooked && (
                        <p className="mt-3 text-xs text-red-300 flex gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Tenés {Math.round(taskMinutes / 6) / 10} h de tareas y {Math.round(free / 6) / 10} h libres. Sacá una o achicá los bloques.
                        </p>
                    )}
                </section>

                <section className="lg:col-span-7 min-w-0">
                    <SectionLabel right="08:00 — 22:00">Agenda de hoy</SectionLabel>
                    <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                        {allDay.map(e => (
                            <div key={e.id} className="flex items-center gap-4 px-4 min-h-[44px] py-2 text-sm">
                                <span className="font-mono text-[11px] text-muted-foreground w-[96px] shrink-0">todo el día</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                                <span className="truncate">{e.title}</span>
                            </div>
                        ))}
                        {timeline.length === 0 && allDay.length === 0 && (
                            <p className="px-4 py-6 text-sm text-muted-foreground">Día sin eventos. Poné hora a las tareas y aparecen acá.</p>
                        )}
                        {timeline.map(item => (
                            <div key={item.key} className="relative flex items-center gap-4 px-4 min-h-[52px] py-2">
                                {item.kind === 'task' && item.idx === 0 && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-amber-400" />}
                                <span className={cn('font-mono text-[11px] w-[96px] shrink-0', overlaps.has(item.key) ? 'text-red-300' : 'text-muted-foreground')}>
                                    {hhmm(item.start)} — {hhmm(item.end)}
                                </span>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.kind === 'event' ? 'bg-sky-400' : 'bg-amber-400')} />
                                <span className="text-sm truncate flex-1">{item.title}</span>
                                {overlaps.has(item.key) && <span className="text-[10px] text-red-300 shrink-0">se pisa</span>}
                            </div>
                        ))}
                    </div>

                    {habits.length > 0 && (
                        <div className="mt-5">
                            <p className="label-caps mb-2">Hábitos</p>
                            <div className="flex flex-wrap gap-1.5">
                                {habits.map(h => (
                                    <span key={h.id} className="text-xs px-2.5 h-7 inline-flex items-center gap-1.5 rounded-lg border border-hairline text-foreground/85">
                                        {h.done_today && <CheckIcon className="w-3 h-3 text-emerald-400" />}
                                        {h.title}
                                        {h.reminder_time && <span className="font-mono text-[10px] text-muted-foreground">{String(h.reminder_time).slice(0, 5)}</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function DaySummary({ focus, tasks, events, habits, objTitle, pendingInbox, onToggle }: {
    focus: string
    tasks: any[]
    events: any[]
    habits: any[]
    objTitle: Map<string, string>
    pendingInbox: number
    onToggle: (t: any) => void
}) {
    const done = tasks.filter(t => t.status === 'Done').length
    const next = tasks.find(t => t.status !== 'Done')
    const timed = events.filter(e => !e.is_all_day && e.start_time)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4 min-w-0">
                {pendingInbox > 0 && (
                    <Link href="/inbox" className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-4 h-12 text-sm hover:border-[hsl(var(--hairline-strong))]">
                        <span className="flex items-center gap-2 text-muted-foreground"><Inbox className="w-4 h-4" /> Entraron {pendingInbox} {pendingInbox === 1 ? 'captura nueva' : 'capturas nuevas'}</span>
                        <span className="text-xs">Procesar <ArrowRight className="w-3 h-3 inline" /></span>
                    </Link>
                )}
                <section className="lamp rounded-2xl p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <p className="label-caps !text-amber-300/90">Foco de hoy</p>
                        <span className="font-mono text-xs text-amber-200/80">{done}/{tasks.length}</span>
                    </div>
                    <h2 className="text-xl font-semibold mt-1">{focus || 'Sin foco'}</h2>
                    <div className="mt-4 rounded-xl border border-amber-400/15 divide-y divide-amber-400/10 bg-background/30">
                        {tasks.map((t, i) => (
                            <button key={t.id} onClick={() => onToggle(t)} className="w-full flex items-center gap-3 px-3.5 min-h-[52px] py-2 text-left hover:bg-amber-400/5">
                                <span className={cn('font-mono text-xs w-4', i === 0 ? 'text-amber-300' : 'text-muted-foreground')}>{i + 1}</span>
                                <Check done={t.status === 'Done'} accent={i === 0} />
                                <span className="flex-1 min-w-0">
                                    <span className={cn('block text-sm leading-snug line-clamp-2', t.status === 'Done' && 'line-through text-muted-foreground')}>{t.title}</span>
                                    {t.objective_id && objTitle.get(t.objective_id) && <span className="block text-xs text-muted-foreground truncate">→ {objTitle.get(t.objective_id)}</span>}
                                </span>
                                {t.block_start && <span className="font-mono text-[11px] text-muted-foreground">{String(t.block_start).slice(0, 5)}</span>}
                            </button>
                        ))}
                    </div>
                    {next && (
                        <Link href={`/foco?task=${next.id}`} className="btn-secondary !min-h-9 h-9 text-xs mt-4">
                            <Focus className="w-4 h-4" /> Modo foco con “{next.title.slice(0, 28)}{next.title.length > 28 ? '…' : ''}”
                        </Link>
                    )}
                </section>
            </div>
            <aside className="lg:col-span-4 space-y-4 min-w-0">
                <Panel>
                    <SectionLabel>Agenda</SectionLabel>
                    {timed.length === 0 ? <p className="text-sm text-muted-foreground">Día libre de eventos.</p> : (
                        <div className="space-y-2">
                            {timed.map(e => (
                                <div key={e.id} className="flex items-center gap-3 text-sm">
                                    <span className="font-mono text-[11px] text-sky-300 w-11 shrink-0">{String(e.start_time).slice(0, 5)}</span>
                                    <span className="truncate">{e.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
                {habits.length > 0 && (
                    <Panel>
                        <SectionLabel right={`${habits.filter(h => h.done_today).length}/${habits.length}`}>Hábitos</SectionLabel>
                        <div className="space-y-1.5">
                            {habits.map(h => (
                                <div key={h.id} className="flex items-center gap-2.5 text-sm">
                                    <Check done={!!h.done_today} />
                                    <span className={cn('truncate', h.done_today && 'line-through text-muted-foreground')}>{h.title}</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}
            </aside>
        </div>
    )
}
