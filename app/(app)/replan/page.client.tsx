'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Compass, ArrowRight, ArrowLeft, Loader2, Check, X, Target, Flame, CheckSquare,
    Clock, Dumbbell, Utensils, Tv, Film, BookOpen, Scissors, RotateCcw, Sparkles,
    AlertTriangle, CalendarClock, Trophy, Repeat, LifeBuoy, History
} from 'lucide-react'
import {
    saveReplanProgress, applyObjectiveDecisions, cleanupTasks, setHabitsActive,
    generateQuarterPlan, applyQuarterPlan, completeReplan, restorePreviousRoutine,
    type ReplanDiagnosis, type QuarterlyReviewRow, type QuarterPlan, type ReplanReflection,
    type ObjectiveDecision, type PlanSelection
} from '@/lib/actions/quarterly'
import { prettyDate, type QuarterInfo } from '@/lib/quarter'
import { cn, formatCurrency, getLocalDateStr } from '@/lib/utils'

interface Props {
    target: QuarterInfo
    current: QuarterInfo
    diagnosis: ReplanDiagnosis
    review: QuarterlyReviewRow | null
    history: Pick<QuarterlyReviewRow, 'year' | 'quarter' | 'status' | 'completed_at' | 'reflection' | 'plan'>[]
    missingMigration: boolean
}

const STEPS = [
    { id: 'volver', label: 'Volver', icon: LifeBuoy },
    { id: 'diagnostico', label: 'Diagnóstico', icon: Compass },
    { id: 'objetivos', label: 'Objetivos', icon: Target },
    { id: 'limpieza', label: 'Limpieza', icon: Scissors },
    { id: 'reflexion', label: 'Reflexión', icon: BookOpen },
    { id: 'plan', label: 'Plan', icon: Sparkles }
] as const

const TOD_LABEL: Record<string, string> = { morning: 'mañana', afternoon: 'tarde', evening: 'noche', anytime: 'cuando puedas' }
const DAY_LABEL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const RECUR_LABEL: Record<string, string> = { weekly: 'semanal', biweekly: 'cada 2 semanas', monthly: 'mensual' }

function freshness(days: number | null) {
    if (days === null) return { text: 'nunca', cls: 'text-muted-foreground border-border/50 bg-secondary/30' }
    if (days <= 2) return { text: days === 0 ? 'hoy' : `hace ${days}d`, cls: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' }
    if (days <= 14) return { text: `hace ${days}d`, cls: 'text-amber-300 border-amber-500/25 bg-amber-500/10' }
    return { text: `hace ${days}d`, cls: 'text-rose-300 border-rose-500/25 bg-rose-500/10' }
}

function nextMonday(today: string): string {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const add = ((8 - dt.getDay()) % 7) || 7
    dt.setDate(dt.getDate() + add)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function ReplanClient({ target, current, diagnosis, review, history, missingMigration }: Props) {
    const router = useRouter()
    const done = review?.status === 'done'
    const [step, setStep] = useState<number>(done ? 5 : Math.min(review?.step ?? 0, 5))
    const [showWizard, setShowWizard] = useState(!done)

    if (missingMigration) {
        return (
            <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24">
                <div className="glass p-6 rounded-2xl border border-amber-500/30 space-y-2">
                    <h1 className="font-heading font-bold text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Falta una migración</h1>
                    <p className="text-sm text-muted-foreground">
                        Pegá <code className="text-amber-300">supabase/migrations/024_quarterly_replan.sql</code> en el SQL Editor de Supabase y recargá esta página.
                    </p>
                </div>
            </div>
        )
    }

    async function goTo(next: number) {
        setStep(next)
        await saveReplanProgress(target.year, target.quarter, {
            step: next,
            ...(next === 1 && !review?.diagnosis ? { diagnosis } : {})
        })
    }

    const isNextQuarter = target.year !== current.year || target.quarter !== current.quarter

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80">
                        Replanificación trimestral · {target.name}
                    </p>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text leading-tight mt-1">
                        {done && !showWizard ? (review?.plan?.tema || `Plan de ${target.name}`) : 'Volver a ordenar todo'}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {prettyDate(target.start)} → {prettyDate(target.end)} ·{' '}
                        {isNextQuarter ? `arranca en ${current.daysLeft} días` : `quedan ${target.daysLeft} días (${target.elapsedPct}% del trimestre ya pasó)`}
                    </p>
                </div>
                {done && (
                    <button
                        onClick={() => { setShowWizard(v => !v); setStep(0) }}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border/60 text-muted-foreground hover:text-white hover:bg-secondary/50 flex items-center gap-1.5 self-start sm:self-auto"
                    >
                        {showWizard ? <><Trophy className="w-3.5 h-3.5" /> Ver el progreso</> : <><RotateCcw className="w-3.5 h-3.5" /> Rehacer la revisión</>}
                    </button>
                )}
            </div>

            {done && !showWizard ? (
                <ProgressView target={target} diagnosis={diagnosis} review={review!} history={history} />
            ) : (
                <>
                    {/* Stepper */}
                    <div className="glass rounded-2xl border border-border/50 p-1.5 flex gap-1 overflow-x-auto no-scrollbar">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon
                            const active = i === step
                            const passed = i < step
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => goTo(i)}
                                    className={cn(
                                        'flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap',
                                        active ? 'bg-teal-500/15 text-teal-200 border border-teal-500/30'
                                            : passed ? 'text-teal-300/70 hover:bg-secondary/40 border border-transparent'
                                                : 'text-muted-foreground hover:bg-secondary/40 border border-transparent'
                                    )}
                                >
                                    {passed ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                    <span>{i + 1}. {s.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {step === 0 && <StepReturn diagnosis={diagnosis} target={target} />}
                            {step === 1 && <StepDiagnosis diagnosis={diagnosis} />}
                            {step === 2 && <StepObjectives diagnosis={diagnosis} target={target} saved={review?.decisions?.objectives} />}
                            {step === 3 && <StepCleanup diagnosis={diagnosis} />}
                            {step === 4 && <StepReflection target={target} initial={review?.reflection || {}} />}
                            {step === 5 && (
                                <StepPlan
                                    target={target}
                                    initialPlan={review?.plan || null}
                                    applied={review?.applied || {}}
                                    onFinished={() => { setShowWizard(false); router.refresh() }}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Nav */}
                    {step < 5 && (
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={() => goTo(Math.max(step - 1, 0))}
                                disabled={step === 0}
                                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white disabled:opacity-0 flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Atrás
                            </button>
                            <button
                                onClick={() => goTo(step + 1)}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-600/20"
                            >
                                {step === 0 ? 'Empezar' : 'Siguiente'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

// ============================================================
// PASO 0 — VOLVER
// ============================================================

function StepReturn({ diagnosis, target }: { diagnosis: ReplanDiagnosis; target: QuarterInfo }) {
    const away = diagnosis.daysInactive ?? 0
    return (
        <div className="space-y-4">
            <div className="glass p-5 md:p-6 rounded-2xl border border-teal-500/25 space-y-3">
                <h2 className="font-heading font-bold text-lg text-white">
                    {away >= 7
                        ? `Hace ${away} días que no registrás nada. Está bien.`
                        : 'Momento de mirar el trimestre desde arriba.'}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                    {away >= 7
                        ? 'No vas a ponerte al día con todo lo que no registraste, y no hace falta. Esto no es para recuperar el mes perdido: es para decidir con qué seguís, soltar lo que quedó viejo y arrancar de nuevo con un plan chico.'
                        : 'Cada trimestre conviene frenar, ver qué funcionó y reacomodar objetivos, hábitos y horarios antes de que el sistema se llene de cosas vencidas.'}
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5 pt-1">
                    <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" /> Son 6 pasos y unos 20 minutos. Se guarda solo: podés dejarlo y volver.</li>
                    <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" /> Al final la IA arma el plan de {target.name} con tus datos: objetivos, hábitos, horario, entreno, comidas y qué ver o leer.</li>
                    <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" /> Vos elegís qué entra. Nada se crea sin que lo tildes.</li>
                </ul>
            </div>

            <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                <h3 className="text-sm font-heading font-bold text-white">Última vez que usaste cada parte</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {diagnosis.modules.map(m => {
                        const f = freshness(m.daysAgo)
                        return (
                            <Link key={m.key} href={m.href} className={cn('px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 hover:brightness-125 transition', f.cls)}>
                                <span className="font-medium truncate text-white/85">{m.label}</span>
                                <span className="font-mono text-[10px] shrink-0">{f.text}</span>
                            </Link>
                        )
                    })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Lo rojo es lo que se te cayó. Ojo con querer revivir todo junto: en el paso 6 elegimos solo lo que suma.
                </p>
            </div>
        </div>
    )
}

// ============================================================
// PASO 1 — DIAGNÓSTICO
// ============================================================

function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
    const toneCls = { default: 'text-white', good: 'text-emerald-300', bad: 'text-rose-300', warn: 'text-amber-300' }[tone]
    return (
        <div className="glass p-4 rounded-2xl border border-border/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-heading font-bold mt-1 tabular-nums', toneCls)}>{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
        </div>
    )
}

function StepDiagnosis({ diagnosis: d }: { diagnosis: ReplanDiagnosis }) {
    const constancia = Math.round((d.activeDays90 / 90) * 100)
    const habitAvg = d.habits.length ? Math.round(d.habits.reduce((s, h) => s + h.pct, 0) / d.habits.length) : null
    const overdue = d.tasks.open.filter(t => t.overdue).length
    const weightDelta = d.weight.first !== null && d.weight.last !== null ? d.weight.last - d.weight.first : null

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Los números de los últimos 90 días, sin interpretación. Mirarlos de frente es la mitad del trabajo.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Constancia" value={`${d.activeDays90}/90`} hint={`días con algún registro (${constancia}%)`} tone={constancia >= 60 ? 'good' : constancia >= 30 ? 'warn' : 'bad'} />
                <Stat label="Tareas" value={`${d.tasks.done90}`} hint={`cerradas · ${d.tasks.missed90} perdidas · ${overdue} vencidas ahora`} tone={d.tasks.done90 > d.tasks.missed90 ? 'good' : 'warn'} />
                <Stat label="Hábitos (30d)" value={habitAvg === null ? '—' : `${habitAvg}%`} hint={`${d.habits.length} activos`} tone={habitAvg === null ? 'default' : habitAvg >= 60 ? 'good' : habitAvg >= 30 ? 'warn' : 'bad'} />
                <Stat label="Entrenamiento" value={`${d.training.sessions90 + d.training.parkSessions90}`} hint={`sesiones · ${d.training.matches90} partidos`} tone={d.training.sessions90 + d.training.parkSessions90 >= 12 ? 'good' : 'bad'} />
                <Stat label="Peso" value={d.weight.last ? `${d.weight.last} kg` : '—'} hint={weightDelta !== null && d.weight.firstDate !== d.weight.lastDate ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg desde ${d.weight.firstDate}` : d.weight.lastDate ? `último registro ${d.weight.lastDate}` : 'sin registros'} />
                <Stat label="Journal" value={`${d.journal.entries90}`} hint={`entradas · ánimo ${d.journal.avgMood ?? '—'}/5`} />
                <Stat label="Compromisos" value={`${d.commitments.done90}/${d.commitments.signed90}`} hint="cumplidos / firmados" />
                <Stat label="Deudas" value={formatCurrency(d.finances.debtTotal)} hint={`${d.finances.entries90} gastos registrados en 90 días`} tone={d.finances.debtTotal > 0 ? 'warn' : 'good'} />
            </div>

            {d.habits.length > 0 && (
                <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                    <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Hábitos, últimos 30 días</h3>
                    <div className="space-y-2.5">
                        {d.habits.map(h => (
                            <div key={h.id} className="space-y-1">
                                <div className="flex justify-between text-xs"><span className="text-white/85">{h.title}</span><span className="text-muted-foreground font-mono">{h.logs30}/{h.expected30}</span></div>
                                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                    <div className={cn('h-full rounded-full', h.pct >= 60 ? 'bg-emerald-400' : h.pct >= 30 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${Math.max(h.pct, 2)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {d.reading.length > 0 && (
                <div className="glass p-4 rounded-2xl border border-border/50 flex flex-wrap gap-3 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Leyendo:</span>
                    {d.reading.map(b => (
                        <span key={b.title} className="text-white/85">{b.title} <span className="text-muted-foreground font-mono">{Math.round((b.page / b.pages) * 100)}%</span></span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ============================================================
// PASO 2 — OBJETIVOS
// ============================================================

function StepObjectives({ diagnosis, target, saved }: { diagnosis: ReplanDiagnosis; target: QuarterInfo; saved?: Record<string, ObjectiveDecision> }) {
    const router = useRouter()
    const [decisions, setDecisions] = useState<Record<string, ObjectiveDecision>>(saved || {})
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState('')

    const objectives = diagnosis.objectives

    async function apply() {
        setSaving(true)
        setResult('')
        const res = await applyObjectiveDecisions(target.year, target.quarter, decisions)
        setSaving(false)
        if (!res.ok) return setResult(`Error: ${res.error}`)
        const r = res.data
        setResult(`Listo: ${r.kept} siguen en ${target.name}, ${r.completed} completados, ${r.cancelled} soltados.`)
        router.refresh()
    }

    if (!objectives.length) {
        return (
            <div className="glass p-6 rounded-2xl border border-border/50 text-sm text-muted-foreground">
                No tenés objetivos activos. Perfecto para arrancar limpio: en el paso 6 la IA te propone hasta 3 para {target.name}.
            </div>
        )
    }

    const options: { id: ObjectiveDecision; label: string; cls: string }[] = [
        { id: 'keep', label: `Sigue en ${target.label}`, cls: 'bg-teal-500/15 text-teal-200 border-teal-500/30' },
        { id: 'complete', label: 'Lo cumplí', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
        { id: 'cancel', label: 'Lo suelto', cls: 'bg-rose-500/15 text-rose-200 border-rose-500/30' }
    ]

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Por cada objetivo, una decisión. Soltar uno que ya no tiene sentido no es fracasar: es dejar lugar para uno que sí.
                Si sigue y la fecha ya venció, se corre al {prettyDate(target.end)}.
            </p>
            <div className="space-y-3">
                {objectives.map(o => (
                    <div key={o.id} className="glass p-4 rounded-2xl border border-border/50 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-semibold">{o.timeframe}{o.year ? ` ${o.year}` : ''}</span>
                                    {o.expired && <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 font-semibold">venció {o.target_date}</span>}
                                </div>
                                <h4 className="font-heading font-bold text-white mt-1.5">{o.title}</h4>
                                {o.key_results.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5">
                                        {o.key_results.map((kr, i) => (
                                            <li key={i} className="text-[11px] text-muted-foreground">· {kr.title}: <span className="font-mono text-white/70">{kr.current}/{kr.target} {kr.unit}</span></li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <span className="text-xl font-heading font-bold text-white tabular-nums shrink-0">{o.progress_pct}%</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {options.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setDecisions(prev => ({ ...prev, [o.id]: opt.id }))}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition',
                                        decisions[o.id] === opt.id ? opt.cls : 'border-border/50 text-muted-foreground hover:text-white'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={apply}
                    disabled={saving || !Object.keys(decisions).length}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Aplicar decisiones ({Object.keys(decisions).length}/{objectives.length})
                </button>
                {result && <span className="text-xs text-muted-foreground">{result}</span>}
            </div>
        </div>
    )
}

// ============================================================
// PASO 3 — LIMPIEZA
// ============================================================

function StepCleanup({ diagnosis }: { diagnosis: ReplanDiagnosis }) {
    const router = useRouter()
    const today = getLocalDateStr()
    const monday = nextMonday(today)
    const [tasks, setTasks] = useState(diagnosis.tasks.open)
    const [selected, setSelected] = useState<Set<string>>(new Set(diagnosis.tasks.open.filter(t => t.overdue || !t.due_date).map(t => t.id)))
    const [busy, setBusy] = useState('')
    const [note, setNote] = useState('')
    const [habits, setHabits] = useState(diagnosis.habits.map(h => ({ ...h, paused: false })))

    function toggle(id: string) {
        setSelected(prev => {
            const n = new Set(prev)
            n.has(id) ? n.delete(id) : n.add(id)
            return n
        })
    }

    async function act(action: 'reschedule' | 'cancel' | 'done', date?: string) {
        const ids = [...selected]
        if (!ids.length) return
        setBusy(action)
        const res = await cleanupTasks(ids, action, date)
        setBusy('')
        if (!res.ok) return setNote(`Error: ${res.error}`)
        const label = action === 'cancel' ? 'soltadas' : action === 'done' ? 'marcadas como hechas' : `reprogramadas para el ${date?.slice(8)}/${date?.slice(5, 7)}`
        setNote(`${res.data} tareas ${label}.`)
        setTasks(prev => action === 'reschedule'
            ? prev.map(t => selected.has(t.id) ? { ...t, due_date: date || today, overdue: false } : t)
            : prev.filter(t => !selected.has(t.id)))
        setSelected(new Set())
        router.refresh()
    }

    async function toggleHabit(id: string, paused: boolean) {
        setHabits(prev => prev.map(h => h.id === id ? { ...h, paused } : h))
        const res = await setHabitsActive([id], !paused)
        if (!res.ok) setNote(`Error: ${res.error}`)
    }

    return (
        <div className="space-y-4">
            <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                <div>
                    <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><CheckSquare className="w-4 h-4 text-indigo-400" /> Tareas abiertas ({tasks.length})</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Ya quedaron tildadas las vencidas y las que no tienen fecha. Lo que no vas a hacer de verdad, soltalo: la lista vuelve a ser creíble.</p>
                </div>
                {tasks.length === 0 ? (
                    <p className="text-xs text-emerald-300">No hay nada pendiente. Arrancás limpio.</p>
                ) : (
                    <>
                        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                            {tasks.map(t => (
                                <label key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/40 cursor-pointer">
                                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="w-3.5 h-3.5 accent-teal-500" />
                                    <span className="text-xs text-white/85 flex-1 min-w-0 truncate">{t.title}</span>
                                    {t.due_date && (
                                        <span className={cn('text-[10px] font-mono shrink-0', t.overdue ? 'text-rose-300' : 'text-muted-foreground')}>{t.due_date.slice(8)}/{t.due_date.slice(5, 7)}</span>
                                    )}
                                </label>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button onClick={() => act('reschedule', today)} disabled={!selected.size || !!busy} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-teal-500/30 bg-teal-500/10 text-teal-200 disabled:opacity-40 flex items-center gap-1.5">
                                {busy === 'reschedule' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarClock className="w-3 h-3" />} Para hoy
                            </button>
                            <button onClick={() => act('reschedule', monday)} disabled={!selected.size || !!busy} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 disabled:opacity-40 flex items-center gap-1.5">
                                <CalendarClock className="w-3 h-3" /> Para el lunes {monday.slice(8)}/{monday.slice(5, 7)}
                            </button>
                            <button onClick={() => act('done')} disabled={!selected.size || !!busy} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 disabled:opacity-40 flex items-center gap-1.5">
                                <Check className="w-3 h-3" /> Ya las hice
                            </button>
                            <button onClick={() => act('cancel')} disabled={!selected.size || !!busy} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-200 disabled:opacity-40 flex items-center gap-1.5">
                                {busy === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Soltar
                            </button>
                        </div>
                    </>
                )}
            </div>

            {habits.length > 0 && (
                <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                    <div>
                        <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Hábitos</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Pausar no borra el historial: lo saca del tablero hasta que tengas lugar. Mejor 2 que cumplís que 5 que te recuerdan que no.</p>
                    </div>
                    <div className="space-y-1.5">
                        {habits.map(h => (
                            <div key={h.id} className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg bg-secondary/20">
                                <div className="min-w-0">
                                    <p className={cn('text-xs truncate', h.paused ? 'text-muted-foreground line-through' : 'text-white/85')}>{h.title}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{h.pct}% en 30 días</p>
                                </div>
                                <button
                                    onClick={() => toggleHabit(h.id, !h.paused)}
                                    className={cn('px-3 py-1 rounded-lg text-[11px] font-semibold border shrink-0', h.paused ? 'border-teal-500/30 text-teal-200' : 'border-border/60 text-muted-foreground hover:text-white')}
                                >
                                    {h.paused ? 'Reactivar' : 'Pausar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
    )
}

// ============================================================
// PASO 4 — REFLEXIÓN
// ============================================================

const REFLECTION_FIELDS: { key: keyof ReplanReflection; label: string; placeholder: string; rows: number }[] = [
    { key: 'funciono', label: '¿Qué funcionó, aunque sea poco?', placeholder: 'Ej: el ritual matutino las semanas que me acosté antes de las 23…', rows: 3 },
    { key: 'no_funciono', label: '¿Qué no funcionó?', placeholder: 'Ej: planear demasiadas cosas por día, el entreno a las 7…', rows: 3 },
    { key: 'desconexion', label: '¿Por qué dejaste de usar el sistema?', placeholder: 'Sin juzgarte: qué pasó la semana que lo soltaste.', rows: 3 },
    { key: 'aprendizaje', label: '¿Qué aprendiste de vos este trimestre?', placeholder: 'Una sola cosa que quieras recordar.', rows: 2 },
    { key: 'palabra', label: 'Una palabra para el trimestre', placeholder: 'Ej: Constancia, Orden, Cuerpo…', rows: 1 }
]

function StepReflection({ target, initial }: { target: QuarterInfo; initial: ReplanReflection }) {
    const [values, setValues] = useState<ReplanReflection>(initial)
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    async function save() {
        setStatus('saving')
        await saveReplanProgress(target.year, target.quarter, { reflection: values })
        setStatus('saved')
    }

    return (
        <div className="glass p-5 rounded-2xl border border-border/50 space-y-4">
            <p className="text-sm text-muted-foreground">Lo que escribas acá lo lee la IA para armar el plan. La pregunta de por qué te desconectaste es la más importante: el plan tiene que estar armado para esa semana mala.</p>
            {REFLECTION_FIELDS.map(f => (
                <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/85">{f.label}</label>
                    {f.rows === 1 ? (
                        <input
                            value={values[f.key] || ''}
                            onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setStatus('idle') }}
                            onBlur={save}
                            placeholder={f.placeholder}
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                    ) : (
                        <textarea
                            value={values[f.key] || ''}
                            onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setStatus('idle') }}
                            onBlur={save}
                            rows={f.rows}
                            placeholder={f.placeholder}
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-y"
                        />
                    )}
                </div>
            ))}
            <p className="text-[11px] text-muted-foreground h-4">
                {status === 'saving' ? 'Guardando…' : status === 'saved' ? '✓ Guardado' : 'Se guarda al salir de cada campo.'}
            </p>
        </div>
    )
}

// ============================================================
// PASO 5 — PLAN
// ============================================================

function emptySelection(plan: QuarterPlan | null): PlanSelection {
    const all = (n: number) => Array.from({ length: n }, (_, i) => i)
    return {
        objetivos: all(plan?.objetivos.length || 0),
        habitos: all(plan?.habitos.length || 0),
        tareas_recurrentes: all(plan?.tareas_recurrentes.length || 0),
        horario: false,
        series: [],
        peliculas: [],
        libros: all(plan?.libros.length || 0)
    }
}

function Section({ icon: Icon, title, color, children, hint }: { icon: any; title: string; color: string; children: React.ReactNode; hint?: string }) {
    return (
        <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
            <div>
                <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><Icon className={cn('w-4 h-4', color)} /> {title}</h3>
                {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {children}
        </div>
    )
}

function Pick({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
    return (
        <label className={cn('flex gap-2.5 p-3 rounded-xl border cursor-pointer transition', checked ? 'border-teal-500/35 bg-teal-500/5' : 'border-border/50 bg-secondary/20 hover:border-border')}>
            <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-teal-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>
        </label>
    )
}

function StepPlan({ target, initialPlan, applied, onFinished }: { target: QuarterInfo; initialPlan: QuarterPlan | null; applied: Record<string, any>; onFinished: () => void }) {
    const [plan, setPlan] = useState<QuarterPlan | null>(initialPlan)
    const [sel, setSel] = useState<PlanSelection>(applied.selection || emptySelection(initialPlan))
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [finishing, setFinishing] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<Record<string, number> | null>(applied.counts || null)

    async function generate() {
        setLoading(true)
        setError('')
        // Si la función se corta (timeout), la acción no devuelve nada y tira:
        // sin este catch el botón quedaba girando para siempre.
        const res = await generateQuarterPlan(target.year, target.quarter).catch(() => ({ ok: false as const, error: 'No pude hablar con el servidor (¿se cortó por tiempo?). Probá de nuevo en unos segundos.' }))
        setLoading(false)
        if (!res.ok) return setError(res.error)
        setPlan(res.data)
        setSel(emptySelection(res.data))
        setResult(null)
    }

    function toggle(key: Exclude<keyof PlanSelection, 'horario'>, i: number) {
        setSel(prev => {
            const list = prev[key]
            return { ...prev, [key]: list.includes(i) ? list.filter(x => x !== i) : [...list, i] }
        })
    }

    const total = useMemo(() => sel.objetivos.length + sel.habitos.length + sel.tareas_recurrentes.length + sel.series.length + sel.peliculas.length + sel.libros.length + (sel.horario ? 1 : 0), [sel])

    async function apply() {
        setApplying(true)
        setError('')
        const res = await applyQuarterPlan(target.year, target.quarter, sel).catch(() => ({ ok: false as const, error: 'No pude hablar con el servidor (¿se cortó por tiempo?). Probá de nuevo en unos segundos.' }))
        setApplying(false)
        if (!res.ok) return setError(res.error)
        setResult(res.data)
    }

    async function finish() {
        setFinishing(true)
        const res = await completeReplan(target.year, target.quarter).catch(() => ({ ok: false as const, error: 'No pude hablar con el servidor (¿se cortó por tiempo?). Probá de nuevo en unos segundos.' }))
        setFinishing(false)
        if (!res.ok) return setError(res.error)
        onFinished()
    }

    if (!plan) {
        return (
            <div className="glass p-6 md:p-8 rounded-2xl border border-teal-500/25 text-center space-y-4">
                <Sparkles className="w-8 h-8 text-teal-300 mx-auto" />
                <div className="space-y-1.5">
                    <h2 className="font-heading font-bold text-lg text-white">Armemos {target.name}</h2>
                    <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                        La IA lee todo tu Segundo Cerebro, el diagnóstico y lo que escribiste, y propone objetivos hasta el {prettyDate(target.end)}, hábitos, tareas recurrentes, un horario tipo, cómo encajar el entreno, comidas y qué ver o leer.
                    </p>
                </div>
                <button onClick={generate} disabled={loading} className="px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-teal-600/20">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {loading ? 'Armando el plan… (puede tardar 30 segundos)' : 'Generar el plan del trimestre'}
                </button>
                {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-left break-words">{error}</p>}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Resumen */}
            <div className="glass p-5 md:p-6 rounded-2xl border border-teal-500/25 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">Tema del trimestre</p>
                        <h2 className="font-heading font-bold text-xl text-white">{plan.tema}</h2>
                    </div>
                    <button onClick={generate} disabled={loading} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-white flex items-center gap-1.5 self-start">
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Generar otro
                    </button>
                </div>
                {plan.diagnostico && <p className="text-sm text-white/80 leading-relaxed">{plan.diagnostico}</p>}
                {plan.regla_regreso && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-100 flex gap-2">
                        <LifeBuoy className="w-4 h-4 text-amber-300 shrink-0" />
                        <span><b>Si te volvés a desconectar:</b> {plan.regla_regreso}</span>
                    </div>
                )}
            </div>

            {plan.objetivos.length > 0 && (
                <Section icon={Target} title="Objetivos" color="text-indigo-400" hint="Se crean con sus resultados clave y tareas fechadas.">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                        {plan.objetivos.map((o, i) => (
                            <Pick key={i} checked={sel.objetivos.includes(i)} onChange={() => toggle('objetivos', i)}>
                                <p className="text-xs font-bold text-white">{o.title}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">meta {o.target_date}</p>
                                <ul className="mt-1.5 space-y-0.5">
                                    {o.key_results.map((kr, k) => <li key={k} className="text-[11px] text-white/70">· {kr.title} <span className="font-mono text-muted-foreground">({kr.current}→{kr.target} {kr.unit})</span></li>)}
                                </ul>
                                {o.tasks.length > 0 && <p className="text-[10px] text-muted-foreground mt-1.5">{o.tasks.length} tareas: {o.tasks.map(t => t.title).join(' · ')}</p>}
                                {o.risk && <p className="text-[10px] text-amber-300/80 mt-1.5">Riesgo: {o.risk}</p>}
                            </Pick>
                        ))}
                    </div>
                </Section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {plan.habitos.length > 0 && (
                    <Section icon={Flame} title="Hábitos" color="text-orange-400">
                        <div className="space-y-2">
                            {plan.habitos.map((h, i) => (
                                <Pick key={i} checked={sel.habitos.includes(i)} onChange={() => toggle('habitos', i)}>
                                    <p className="text-xs font-semibold text-white">{h.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {h.frequency_type === 'daily' ? 'todos los días' : `${h.frequency_times_per_week}x por semana`} · {h.estimated_minutes} min · {TOD_LABEL[h.time_of_day]}
                                    </p>
                                    {h.why && <p className="text-[11px] text-white/60 mt-1">{h.why}</p>}
                                </Pick>
                            ))}
                        </div>
                    </Section>
                )}

                {plan.tareas_recurrentes.length > 0 && (
                    <Section icon={Repeat} title="Tareas recurrentes" color="text-sky-400">
                        <div className="space-y-2">
                            {plan.tareas_recurrentes.map((r, i) => (
                                <Pick key={i} checked={sel.tareas_recurrentes.includes(i)} onChange={() => toggle('tareas_recurrentes', i)}>
                                    <p className="text-xs font-semibold text-white">{r.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{RECUR_LABEL[r.recurrence_type]}{r.recurrence_days.length ? ` · ${r.recurrence_days.map(d => DAY_LABEL[d]).join(', ')}` : ''}</p>
                                    {r.why && <p className="text-[11px] text-white/60 mt-1">{r.why}</p>}
                                </Pick>
                            ))}
                        </div>
                    </Section>
                )}
            </div>

            {plan.horario.length > 0 && (
                <Section icon={Clock} title="Horario tipo" color="text-violet-400" hint="Si lo aplicás reemplaza tu Rutina Ideal del dashboard. La anterior queda guardada y la podés restaurar.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {plan.horario.map((b, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/25 text-xs">
                                <span className="font-mono text-violet-300 shrink-0 w-[92px]">{b.time}</span>
                                <span className="text-white/85 truncate">{b.activity}</span>
                            </div>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/85 cursor-pointer pt-1">
                        <input type="checkbox" checked={sel.horario} onChange={() => setSel(s => ({ ...s, horario: !s.horario }))} className="w-3.5 h-3.5 accent-violet-500" />
                        Usar este horario como mi rutina ideal
                    </label>
                    {applied.previousRoutine && (
                        <button
                            onClick={async () => { const r = await restorePreviousRoutine(target.year, target.quarter); alert(r.ok ? 'Volviste a tu horario anterior.' : r.error) }}
                            className="text-[11px] text-muted-foreground hover:text-white underline underline-offset-2"
                        >
                            Restaurar mi horario anterior
                        </button>
                    )}
                </Section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(plan.entrenamiento.resumen || plan.entrenamiento.semana.length > 0) && (
                    <Section icon={Dumbbell} title="Entrenamiento" color="text-emerald-400">
                        {plan.entrenamiento.resumen && <p className="text-xs text-white/80 leading-relaxed">{plan.entrenamiento.resumen}</p>}
                        <div className="space-y-1">
                            {plan.entrenamiento.semana.map((s, i) => (
                                <div key={i} className="flex gap-3 text-xs"><span className="w-16 shrink-0 text-emerald-300 font-semibold">{s.dia}</span><span className="text-white/75">{s.que}</span></div>
                            ))}
                        </div>
                        <Link href="/entrenamiento" className="text-[11px] text-emerald-300 hover:underline inline-flex items-center gap-1">Ir a Entrenamiento <ArrowRight className="w-3 h-3" /></Link>
                    </Section>
                )}

                {(plan.comidas.enfoque || plan.comidas.ideas.length > 0) && (
                    <Section icon={Utensils} title="Comidas" color="text-amber-400">
                        {plan.comidas.enfoque && <p className="text-xs text-white/80 leading-relaxed">{plan.comidas.enfoque}</p>}
                        {plan.comidas.ideas.length > 0 && <ul className="space-y-0.5">{plan.comidas.ideas.map((x, i) => <li key={i} className="text-[11px] text-white/70">· {x}</li>)}</ul>}
                        {plan.comidas.compras.length > 0 && <p className="text-[11px] text-muted-foreground"><b className="text-white/70">Lista base:</b> {plan.comidas.compras.join(', ')}</p>}
                        <Link href="/meals/nutrition" className="text-[11px] text-amber-300 hover:underline inline-flex items-center gap-1">Ir al Nutricionista <ArrowRight className="w-3 h-3" /></Link>
                    </Section>
                )}
            </div>

            {(plan.series.length + plan.peliculas.length + plan.libros.length) > 0 && (
                <Section icon={Tv} title="Para ver y leer" color="text-pink-400" hint="Lo que tildes se agrega a Entretenimiento (si ya estaba, no se duplica).">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {([
                            ['libros', 'Libros', BookOpen, plan.libros],
                            ['series', 'Series', Tv, plan.series],
                            ['peliculas', 'Películas', Film, plan.peliculas]
                        ] as const).map(([key, label, Icon, list]) => list.length > 0 && (
                            <div key={key} className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Icon className="w-3 h-3" /> {label}</p>
                                {list.map((m, i) => (
                                    <Pick key={i} checked={sel[key].includes(i)} onChange={() => toggle(key, i)}>
                                        <p className="text-xs font-semibold text-white">{m.title}{m.author ? <span className="font-normal text-muted-foreground"> · {m.author}</span> : null}</p>
                                        {m.why && <p className="text-[10px] text-white/60 mt-0.5">{m.why}</p>}
                                    </Pick>
                                ))}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {plan.recortar.length > 0 && (
                <Section icon={Scissors} title="Para dejar de hacer" color="text-rose-400">
                    <ul className="space-y-1">{plan.recortar.map((x, i) => <li key={i} className="text-xs text-white/80 flex gap-2"><X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />{x}</li>)}</ul>
                </Section>
            )}

            {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 break-words">{error}</p>}

            {/* Acciones */}
            <div className="glass p-4 rounded-2xl border border-teal-500/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky bottom-20 md:bottom-4 z-10">
                <p className="text-xs text-muted-foreground">
                    {result
                        ? `Aplicado: ${result.objetivos} objetivos, ${result.tareas} tareas, ${result.habitos} hábitos, ${result.recurrentes} recurrentes${result.horario ? ', horario' : ''}${result.media ? `, ${result.media} al backlog` : ''}.`
                        : `${total} cosas seleccionadas.`}
                </p>
                <div className="flex gap-2">
                    {!result && (
                        <button onClick={apply} disabled={applying || !total} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aplicar lo tildado
                        </button>
                    )}
                    <button onClick={finish} disabled={finishing} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                        {finishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />} Cerrar la revisión
                    </button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// VISTA DE PROGRESO (después de cerrar la revisión)
// ============================================================

function ProgressView({ target, diagnosis, review, history }: { target: QuarterInfo; diagnosis: ReplanDiagnosis; review: QuarterlyReviewRow; history: Props['history'] }) {
    const plan = review.plan
    const objectives = diagnosis.objectives.filter(o => o.timeframe === target.label || o.timeframe === 'Year')
    const reflection = review.reflection || {}

    return (
        <div className="space-y-4">
            <div className="glass p-5 rounded-2xl border border-teal-500/25 space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tiempo transcurrido de {target.name}</span>
                    <span className="font-mono text-white">{target.elapsedPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                    <div className="h-full bg-teal-400/80 rounded-full" style={{ width: `${Math.max(target.elapsedPct, 2)}%` }} />
                </div>
                {reflection.palabra && <p className="text-xs text-muted-foreground">Palabra del trimestre: <b className="text-teal-200">{reflection.palabra}</b></p>}
                {plan?.regla_regreso && <p className="text-xs text-amber-200/90 flex gap-2"><LifeBuoy className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {plan.regla_regreso}</p>}
            </div>

            <div className="glass p-5 rounded-2xl border border-border/50 space-y-3">
                <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><Target className="w-4 h-4 text-indigo-400" /> ¿Vas al ritmo del calendario?</h3>
                {objectives.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay objetivos activos para {target.name}.</p>
                ) : objectives.map(o => {
                    const gap = o.progress_pct - target.elapsedPct
                    return (
                        <div key={o.id} className="space-y-1">
                            <div className="flex justify-between gap-3 text-xs">
                                <span className="text-white/85 truncate">{o.title}</span>
                                <span className={cn('font-mono shrink-0', gap >= 0 ? 'text-emerald-300' : gap > -20 ? 'text-amber-300' : 'text-rose-300')}>
                                    {o.progress_pct}% {gap >= 0 ? '· al día' : `· ${Math.abs(gap)} pts atrás`}
                                </span>
                            </div>
                            <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.max(o.progress_pct, 2)}%` }} />
                                <div className="absolute top-0 h-full w-0.5 bg-white/60" style={{ left: `${target.elapsedPct}%` }} />
                            </div>
                        </div>
                    )
                })}
                <Link href="/okrs" className="text-[11px] text-indigo-300 hover:underline inline-flex items-center gap-1">Actualizar resultados clave <ArrowRight className="w-3 h-3" /></Link>
            </div>

            {plan && (plan.entrenamiento.semana.length > 0 || plan.comidas.enfoque) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {plan.entrenamiento.semana.length > 0 && (
                        <Section icon={Dumbbell} title="Semana de entreno" color="text-emerald-400">
                            {plan.entrenamiento.semana.map((s, i) => (
                                <div key={i} className="flex gap-3 text-xs"><span className="w-16 shrink-0 text-emerald-300 font-semibold">{s.dia}</span><span className="text-white/75">{s.que}</span></div>
                            ))}
                        </Section>
                    )}
                    {plan.comidas.enfoque && (
                        <Section icon={Utensils} title="Enfoque de comidas" color="text-amber-400">
                            <p className="text-xs text-white/80 leading-relaxed">{plan.comidas.enfoque}</p>
                        </Section>
                    )}
                </div>
            )}

            {history.length > 0 && (
                <div className="glass p-5 rounded-2xl border border-border/50 space-y-2">
                    <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Trimestres anteriores</h3>
                    {history.map(h => (
                        <Link key={`${h.year}-${h.quarter}`} href={`/replan?q=${h.year}-${h.quarter}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-secondary/40 text-xs">
                            <span className="text-white/85">Q{h.quarter} {h.year}{h.plan?.tema ? ` · ${h.plan.tema}` : ''}</span>
                            <span className={cn('text-[10px] font-semibold', h.status === 'done' ? 'text-emerald-300' : 'text-amber-300')}>{h.status === 'done' ? 'cerrada' : 'a medias'}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
