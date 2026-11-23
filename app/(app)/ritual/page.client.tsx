'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sun, Inbox, Target, CalendarClock, ArrowRight, ArrowLeft, Check, CheckCircle2,
    Loader2, Wand2, AlertTriangle, Plus, Flame, RefreshCw, ChevronDown, X, Clock
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import {
    saveRitualLog, saveRitualDraft, suggestMorningPlan, planTasksForDay, createTaskForDay,
    type MorningRitualLog
} from '@/lib/actions/morning_ritual'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { InboxTriage } from '@/components/plan/InboxTriage'
import { cn, getPriorityColor, getPriorityLabel } from '@/lib/utils'

interface Props {
    existingLog: MorningRitualLog | null
    morningData: any
    todayStr: string
}

const MAX_FOCUS = 3

const STEPS = [
    { id: 'inbox', label: 'Vaciar Inbox', icon: Inbox },
    { id: 'focus', label: 'Elegir foco', icon: Target },
    { id: 'day', label: 'Tu día', icon: CalendarClock }
] as const

/**
 * Planificar el día.
 *
 * 1. Vaciar el Inbox: ahí se anota todo durante el día, así que va primero.
 * 2. Elegir el foco entre las tareas abiertas, viendo objetivos y hábitos.
 * 3. Ver el día armado (eventos + foco + hábitos) y arrancar.
 */
export function RitualClient({ existingLog, morningData, todayStr }: Props) {
    const router = useRouter()
    const isCompleted = !!existingLog?.completed_at
    const inboxNotes: any[] = morningData?.inboxNotes || []

    const [editing, setEditing] = useState(!isCompleted)
    // Si el Inbox ya está vacío, se arranca directo en el foco.
    const [step, setStep] = useState(inboxNotes.length ? 0 : 1)
    const [focusText, setFocusText] = useState(existingLog?.daily_objective || '')
    const [selected, setSelected] = useState<string[]>(existingLog?.mit_task_ids || [])
    const [extraTasks, setExtraTasks] = useState<any[]>([])
    const [statusOverride, setStatusOverride] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [log, setLog] = useState<MorningRitualLog | null>(existingLog)

    // IA
    const [planning, setPlanning] = useState(false)
    const [planError, setPlanError] = useState('')
    const [plan, setPlan] = useState<any>(null)

    const tasks: any[] = useMemo(() => {
        const base: any[] = morningData?.tasks || []
        const ids = new Set(base.map(t => t.id))
        return [...base, ...extraTasks.filter(t => !ids.has(t.id))]
            .map(t => (statusOverride[t.id] ? { ...t, status: statusOverride[t.id] } : t))
    }, [morningData?.tasks, extraTasks, statusOverride])

    const objectives: any[] = morningData?.objectives || []
    const habits: any[] = morningData?.habits || []
    const events: any[] = morningData?.events || []
    const objTitle = useMemo(() => new Map(objectives.map(o => [o.id, o.title])), [objectives])

    const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])
    const selectedTasks = selected.map(id => taskById.get(id)).filter(Boolean) as any[]
    const effectiveFocus = focusText.trim() || selectedTasks[0]?.title || ''

    function toggle(id: string) {
        setSelected(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id)
            if (prev.length >= MAX_FOCUS) return prev
            return [...prev, id]
        })
    }

    function goTo(i: number) {
        saveRitualDraft(todayStr, focusText, undefined, selected)
        // Lo que salió del Inbox como tarea tiene que aparecer para elegir.
        if (step === 0 && i > 0) router.refresh()
        setStep(i)
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
        const [res] = await Promise.all([
            saveRitualLog(todayStr, effectiveFocus, undefined, selected),
            planTasksForDay(selected, todayStr)
        ])
        setSaving(false)
        if (res.error) return alert(res.error)
        if (res.log) setLog(res.log)
        setEditing(false)
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
        router.refresh()
    }

    async function toggleDone(task: any) {
        const next = task.status === 'Done' ? 'Todo' : 'Done'
        setStatusOverride(s => ({ ...s, [task.id]: next }))
        await updateTaskStatus(task.id, next)
    }

    return (
        <div className="px-3 py-4 md:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in pb-28">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Sun className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Planificar el día</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Vaciá el Inbox, elegí el foco y arrancá.</p>
                    </div>
                </div>
                {!editing && (
                    <button
                        onClick={() => { setEditing(true); setStep(inboxNotes.length ? 0 : 1) }}
                        className="px-4 py-2 bg-secondary/60 hover:bg-secondary border border-border rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto"
                    >
                        <RefreshCw className="w-4 h-4" /> Replanificar
                    </button>
                )}
            </div>

            {!editing && log ? (
                <DaySummary
                    focus={log.daily_objective || ''}
                    tasks={selectedTasks}
                    events={events}
                    habits={habits}
                    objTitle={objTitle}
                    pendingInbox={inboxNotes.length}
                    onToggle={toggleDone}
                />
            ) : (
                <div className="space-y-5">
                    {/* Stepper */}
                    <div className="grid grid-cols-3 gap-2">
                        {STEPS.map((s, i) => {
                            const active = i === step
                            const done = i < step
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => goTo(i)}
                                    className={cn(
                                        'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all min-w-0',
                                        active ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                            : done ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                                : 'bg-secondary/30 border-border/50 text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                                    <span className="truncate max-w-full">
                                        {s.label}
                                        {s.id === 'inbox' && inboxNotes.length > 0 && (
                                            <span className="ml-1 text-[10px] px-1.5 rounded-full bg-indigo-500/30 text-indigo-200">{inboxNotes.length}</span>
                                        )}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div className="glass rounded-3xl p-4 md:p-7 border border-border/50 shadow-xl flex flex-col">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex-1 space-y-4"
                            >
                                {step === 0 && (
                                    <>
                                        <StepTitle icon={Inbox} color="text-indigo-400" title="Vaciá el Inbox"
                                            hint="Todo lo que anotaste va a algún lado: a hoy, a tareas, a la agenda o a ideas. Lo que no sirve, se archiva." />
                                        <InboxTriage
                                            notes={inboxNotes}
                                            dateStr={todayStr}
                                        />
                                    </>
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
                                        onCreated={task => {
                                            setExtraTasks(prev => [...prev, task])
                                            setSelected(prev => prev.length < MAX_FOCUS ? [...prev, task.id] : prev)
                                        }}
                                        planning={planning}
                                        planError={planError}
                                        plan={plan}
                                        onSuggest={handleSuggest}
                                    />
                                )}

                                {step === 2 && (
                                    <>
                                        <StepTitle icon={CalendarClock} color="text-emerald-400" title="Así queda tu día"
                                            hint="Revisalo de un vistazo. Si algo no entra, volvé y sacá una tarea." />
                                        <DayPreview
                                            focus={effectiveFocus}
                                            tasks={selectedTasks}
                                            events={events}
                                            habits={habits}
                                            objTitle={objTitle}
                                        />
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        <div className="flex items-center justify-between gap-2 pt-4 mt-5 border-t border-white/5">
                            <button
                                onClick={() => goTo(Math.max(0, step - 1))}
                                disabled={step === 0}
                                className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Anterior
                            </button>

                            {step < STEPS.length - 1 ? (
                                <button
                                    onClick={() => goTo(step + 1)}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                                >
                                    {step === 0 ? 'Elegir el foco' : 'Ver el día'} <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleFinish}
                                    disabled={saving || !selected.length}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Arrancar el día
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ------------------------------------------------------------

function StepTitle({ icon: Icon, color, title, hint }: { icon: any; color: string; title: string; hint: string }) {
    return (
        <div className="space-y-1">
            <h2 className={cn('flex items-center gap-2 font-heading font-bold text-lg', color)}>
                <Icon className="w-5 h-5" /> <span className="text-foreground">{title}</span>
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
        </div>
    )
}

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
    onCreated: (task: any) => void
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

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        if (!newTask.trim()) return
        setCreating(true)
        const res = await createTaskForDay(newTask, todayStr)
        setCreating(false)
        if (res.error || !res.task) return alert(res.error || 'No se pudo crear.')
        props.onCreated(res.task)
        setNewTask('')
    }

    const busyDay = events.filter(e => !e.is_all_day).length

    return (
        <div className="space-y-5">
            <StepTitle icon={Target} color="text-amber-400" title="Elegí el foco"
                hint={`Hasta ${MAX_FOCUS} tareas. La primera es la que hace que el día valga la pena.`} />

            {/* Foco en una línea */}
            <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">Foco del día</label>
                <input
                    value={props.focusText}
                    onChange={e => props.setFocusText(e.target.value)}
                    placeholder={selected.length ? 'Si lo dejás vacío, el foco es tu primera tarea' : 'Ej: Entregar la propuesta de Gutmark'}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
            </div>

            {/* Contexto: objetivos y hábitos */}
            {(objectives.length > 0 || habits.length > 0 || busyDay > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                    {objectives.length > 0 && (
                        <div className="p-3 rounded-2xl bg-secondary/30 border border-border/50 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Tus objetivos</span>
                            <div className="space-y-1.5">
                                {objectives.slice(0, 4).map(o => (
                                    <div key={o.id} className="flex items-center gap-2 text-[11px]">
                                        <span className="flex-1 min-w-0 truncate text-foreground/90">{o.title}</span>
                                        <div className="w-14 h-1.5 rounded-full bg-black/40 overflow-hidden shrink-0">
                                            <div className="h-full bg-violet-400" style={{ width: `${Math.min(100, o.progress_pct || 0)}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {habits.length > 0 && (
                        <div className="p-3 rounded-2xl bg-secondary/30 border border-border/50 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1">
                                <Flame className="w-3 h-3" /> Hábitos de hoy
                                {busyDay > 0 && <span className="ml-auto normal-case tracking-normal font-medium text-muted-foreground">{busyDay} {busyDay === 1 ? 'evento' : 'eventos'} con hora</span>}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {habits.map(h => (
                                    <span key={h.id} className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full border',
                                        h.done_today ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 line-through' : 'border-border text-foreground/80'
                                    )}>
                                        {h.title}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Elegidas */}
            {selected.length > 0 && (
                <div className="space-y-1.5">
                    {selected.map((id, i) => {
                        const t = tasks.find(x => x.id === id)
                        if (!t) return null
                        return (
                            <div key={id} className={cn(
                                'flex items-center gap-3 p-3 rounded-xl border',
                                i === 0 ? 'bg-amber-500/10 border-amber-500/35' : 'bg-indigo-500/10 border-indigo-500/25'
                            )}>
                                <span className={cn('w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0',
                                    i === 0 ? 'bg-amber-500 text-black' : 'bg-indigo-500/40 text-indigo-100')}>
                                    {i + 1}
                                </span>
                                <span className="flex-1 min-w-0 text-sm font-semibold text-white leading-snug line-clamp-2">{t.title}</span>
                                <button onClick={() => onToggle(id)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Quitar">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* IA: solo ordena tareas existentes */}
            <div className="space-y-2">
                <button
                    onClick={props.onSuggest}
                    disabled={props.planning || !open.length}
                    className="w-full py-2.5 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {props.planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {props.planning ? 'Mirando tus tareas y objetivos…' : props.focusText.trim() ? 'Que la IA elija las tareas para este foco' : 'Que la IA elija entre mis tareas'}
                </button>
                {props.planError && (
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-2.5">{props.planError}</p>
                )}
                {props.plan?.reasoning && (
                    <p className="text-[11px] text-violet-300/90 bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5 leading-relaxed">{props.plan.reasoning}</p>
                )}
                {props.plan?.warning && (
                    <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> {props.plan.warning}
                    </p>
                )}
            </div>

            {/* Tareas para elegir */}
            <div className="space-y-4">
                <TaskGroup title="Para hoy o vencidas" tasks={forToday} {...{ selected, onToggle, objTitle }} empty="Nada planificado ni vencido para hoy." />
                {forGoals.length > 0 && <TaskGroup title="Empujan un objetivo" tasks={forGoals} {...{ selected, onToggle, objTitle }} />}
                {rest.length > 0 && (
                    <div className="space-y-2">
                        <TaskGroup title="El resto" tasks={restShown} {...{ selected, onToggle, objTitle }} />
                        {rest.length > 6 && (
                            <button onClick={() => setShowAll(v => !v)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAll && 'rotate-180')} />
                                {showAll ? 'Ver menos' : `Ver las ${rest.length} tareas`}
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleCreate} className="flex gap-2">
                    <input
                        value={newTask}
                        onChange={e => setNewTask(e.target.value)}
                        placeholder="¿No está en la lista? Agregá una tarea para hoy"
                        className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <button type="submit" disabled={creating || !newTask.trim()} className="px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white flex items-center" aria-label="Agregar tarea">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                </form>
            </div>
        </div>
    )
}

function TaskGroup({ title, tasks, selected, onToggle, objTitle, empty }: {
    title: string
    tasks: any[]
    selected: string[]
    onToggle: (id: string) => void
    objTitle: Map<string, string>
    empty?: string
}) {
    return (
        <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
            {tasks.length === 0 && empty ? (
                <p className="text-[11px] text-muted-foreground/80 italic">{empty}</p>
            ) : tasks.map(t => {
                const idx = selected.indexOf(t.id)
                const isSel = idx >= 0
                const full = !isSel && selected.length >= MAX_FOCUS
                return (
                    <button
                        key={t.id}
                        onClick={() => onToggle(t.id)}
                        disabled={full}
                        className={cn(
                            'w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all min-h-[48px]',
                            isSel ? 'bg-amber-500/10 border-amber-500/30' : 'bg-secondary/25 border-border/40 hover:bg-secondary/50',
                            full && 'opacity-40 cursor-not-allowed'
                        )}
                    >
                        <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0',
                            isSel ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/20')}>
                            {isSel ? idx + 1 : ''}
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm text-foreground leading-snug line-clamp-2">{t.title}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {t.objective_id && objTitle.get(t.objective_id) && (
                                    <span className="text-[10px] text-violet-300/80 truncate max-w-full">→ {objTitle.get(t.objective_id)}</span>
                                )}
                                {t.due_date && (
                                    <span className="text-[10px] text-muted-foreground font-mono">{String(t.due_date).slice(5, 10).split('-').reverse().join('/')}</span>
                                )}
                                <span className={cn('text-[10px] px-1.5 rounded-full font-medium', getPriorityColor(t.priority))}>
                                    {getPriorityLabel(t.priority)}
                                </span>
                            </span>
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

/** Línea de tiempo del día: eventos con hora + foco + hábitos. */
function DayPreview({ focus, tasks, events, habits, objTitle, agendaOnly }: {
    agendaOnly?: boolean
    focus: string
    tasks: any[]
    events: any[]
    habits: any[]
    objTitle: Map<string, string>
}) {
    const timed = events.filter(e => !e.is_all_day && e.start_time)
    const allDay = events.filter(e => e.is_all_day || !e.start_time)

    return (
        <div className="space-y-4">
            {!agendaOnly && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Foco</span>
                    <p className="text-base font-semibold text-white mt-0.5">{focus || 'Elegí al menos una tarea'}</p>
                </div>
            )}

            <div className={cn('grid gap-4', !agendaOnly && 'md:grid-cols-2')}>
                {!agendaOnly && <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Tareas</span>
                    {tasks.length === 0 ? <p className="text-xs text-muted-foreground italic">Sin tareas elegidas.</p> : tasks.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2.5 text-sm">
                            <span className={cn('w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0',
                                i === 0 ? 'bg-amber-500 text-black' : 'bg-indigo-500/30 text-indigo-100')}>{i + 1}</span>
                            <span className="flex-1 min-w-0 truncate">{t.title}</span>
                            {t.objective_id && objTitle.get(t.objective_id) && <Target className="w-3.5 h-3.5 text-violet-300 shrink-0" />}
                        </div>
                    ))}
                </div>}

                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">Agenda</span>
                    {events.length === 0 ? <p className="text-xs text-muted-foreground italic">Día libre de eventos.</p> : (
                        <>
                            {allDay.map(e => (
                                <div key={e.id} className="text-xs flex items-center gap-2"><span className="text-muted-foreground w-12 shrink-0">Todo el día</span><span className="truncate">{e.title}</span></div>
                            ))}
                            {timed.map(e => (
                                <div key={e.id} className="text-xs flex items-center gap-2">
                                    <span className="font-mono text-sky-300 w-12 shrink-0">{String(e.start_time).slice(0, 5)}</span>
                                    <span className="truncate">{e.title}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {habits.length > 0 && (
                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300">Hábitos</span>
                    <div className="flex flex-wrap gap-1.5">
                        {habits.map(h => (
                            <span key={h.id} className="text-[11px] px-2.5 py-1 rounded-full bg-secondary/40 border border-border/50 flex items-center gap-1.5">
                                {h.done_today ? <Check className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-muted-foreground" />}
                                {h.title}
                            </span>
                        ))}
                    </div>
                </div>
            )}
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

    return (
        <div className="space-y-4">
            {pendingInbox > 0 && (
                <Link href="/inbox" className="glass p-3.5 rounded-2xl border border-indigo-500/30 flex items-center justify-between gap-3 hover:bg-indigo-500/5">
                    <span className="text-xs text-indigo-200 flex items-center gap-2">
                        <Inbox className="w-4 h-4" /> Entraron {pendingInbox} {pendingInbox === 1 ? 'captura nueva' : 'capturas nuevas'} al Inbox
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-300">Procesar →</span>
                </Link>
            )}

            <div className="glass rounded-3xl p-5 md:p-7 border border-emerald-500/25 space-y-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Foco de hoy</span>
                        <p className="text-lg font-heading font-bold text-white mt-0.5">{focus || 'Sin foco'}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3 py-1 shrink-0">
                        {done}/{tasks.length}
                    </span>
                </div>

                <div className="space-y-2">
                    {tasks.map((t, i) => {
                        const isDone = t.status === 'Done'
                        return (
                            <button
                                key={t.id}
                                onClick={() => onToggle(t)}
                                className={cn(
                                    'w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition-all',
                                    isDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-secondary/40 border-border/50 hover:bg-secondary/60'
                                )}
                            >
                                <span className={cn('w-6 h-6 rounded-lg border flex items-center justify-center shrink-0',
                                    isDone ? 'bg-emerald-600 border-emerald-500 text-white' : i === 0 ? 'border-amber-400/60' : 'border-white/20')}>
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className={cn('block text-sm font-semibold leading-snug line-clamp-2', isDone ? 'line-through text-muted-foreground' : 'text-white')}>{t.title}</span>
                                    {t.objective_id && objTitle.get(t.objective_id) && (
                                        <span className="block text-[10px] text-violet-300/80 truncate">→ {objTitle.get(t.objective_id)}</span>
                                    )}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="glass rounded-3xl p-5 border border-border/50">
                <DayPreview agendaOnly focus={focus} tasks={[]} events={events} habits={habits} objTitle={objTitle} />
            </div>
        </div>
    )
}
