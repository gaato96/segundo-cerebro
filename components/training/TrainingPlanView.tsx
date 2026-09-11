'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Dumbbell, Clock, Repeat, Check, RefreshCw, Shuffle,
    Loader2, ChevronDown, Moon, Info, Zap
} from 'lucide-react'
import { logTrainingSession, undoTrainingSession, regenerateWeek, swapExercise } from '@/lib/actions/training'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props {
    plan: any
    logs: any[]
    currentWeek: number
}

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const BLOCK_STYLE: Record<string, { label: string; color: string; icon: any }> = {
    calentamiento: { label: 'Entrada en calor', color: 'text-sky-400 border-sky-500/25 bg-sky-500/5', icon: Zap },
    principal: { label: 'Bloque principal', color: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5', icon: Dumbbell },
    soga: { label: 'Soga', color: 'text-amber-400 border-amber-500/25 bg-amber-500/5', icon: Repeat },
    vuelta_calma: { label: 'Vuelta a la calma', color: 'text-violet-400 border-violet-500/25 bg-violet-500/5', icon: Moon }
}

export function TrainingPlanView({ plan, logs, currentWeek }: Props) {
    const router = useRouter()
    const weeks = plan?.plan_data?.weeks || []
    const stats = plan?.plan_data?.stats
    const [selectedWeek, setSelectedWeek] = useState(currentWeek)
    const [openDay, setOpenDay] = useState<number | null>(0)
    const [busy, setBusy] = useState<string | null>(null)

    const week = useMemo(() => weeks.find((w: any) => w.week === selectedWeek), [weeks, selectedWeek])

    const doneSet = useMemo(
        () => new Set(logs.filter(l => l.completed).map(l => `${l.week_number}-${l.day_index}`)),
        [logs]
    )

    const weekProgress = week
        ? week.days.filter((d: any) => doneSet.has(`${selectedWeek}-${d.index}`)).length
        : 0

    async function toggleDone(dayIndex: number) {
        const key = `${selectedWeek}-${dayIndex}`
        setBusy(key)
        try {
            if (doneSet.has(key)) {
                await undoTrainingSession(plan.id, selectedWeek, dayIndex)
            } else {
                await logTrainingSession({ planId: plan.id, weekNumber: selectedWeek, dayIndex })
            }
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setBusy(null)
        }
    }

    async function handleRegenerate() {
        if (!confirm(`¿Volver a sortear todos los ejercicios de la semana ${selectedWeek}? La estructura y la progresión se mantienen.`)) return
        setBusy('regen')
        try {
            await regenerateWeek(plan.id, selectedWeek)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setBusy(null)
        }
    }

    async function handleSwap(dayIndex: number, blockIndex: number, itemIndex: number) {
        const key = `swap-${dayIndex}-${blockIndex}-${itemIndex}`
        setBusy(key)
        try {
            await swapExercise(plan.id, selectedWeek, dayIndex, blockIndex, itemIndex)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setBusy(null)
        }
    }

    if (!week) {
        return <p className="text-sm text-muted-foreground">No se encontró la semana {selectedWeek} en el plan.</p>
    }

    return (
        <div className="space-y-5">
            {/* Resumen del plan */}
            <div className="glass p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 to-secondary/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-heading font-bold text-foreground">{plan.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {plan.start_date} → {plan.end_date} · {plan.days_per_week} días/semana · {plan.session_minutes} min
                        </p>
                    </div>
                    {stats && (
                        <div className="flex gap-4 text-center shrink-0">
                            <Stat value={stats.total_sessions} label="sesiones" />
                            <Stat value={stats.unique_exercises} label="ejercicios distintos" />
                            {stats.total_rope_minutes > 0 && <Stat value={`${stats.total_rope_minutes}′`} label="de soga" />}
                        </div>
                    )}
                </div>
                {plan.plan_data?.summary && (
                    <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/40 leading-relaxed">
                        {plan.plan_data.summary}
                    </p>
                )}
            </div>

            {/* Selector de semanas */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        12 semanas · 3 bloques
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        Hoy estás en la semana {currentWeek}
                    </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {weeks.map((w: any) => {
                        const active = w.week === selectedWeek
                        const done = w.days.filter((d: any) => doneSet.has(`${w.week}-${d.index}`)).length
                        const complete = done === w.days.length
                        return (
                            <button
                                key={w.week}
                                onClick={() => { setSelectedWeek(w.week); setOpenDay(0) }}
                                className={cn(
                                    'relative shrink-0 w-[52px] py-2 rounded-xl border text-center transition-all',
                                    active
                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                        : complete
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                            : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground',
                                    w.week === currentWeek && !active && 'ring-1 ring-amber-500/50'
                                )}
                            >
                                <span className="block text-[9px] opacity-70 leading-none">SEM</span>
                                <span className="block text-sm font-bold leading-tight">{w.week}</span>
                                {w.deload && <span className="block text-[8px] font-bold text-amber-400 leading-none">carga↓</span>}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Cabecera de la semana */}
            <div className={cn(
                'glass p-4 rounded-2xl border space-y-2',
                week.deload ? 'border-amber-500/30 bg-amber-950/10' : 'border-border/50'
            )}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground">Semana {week.week} · {week.block}</h4>
                            {week.deload && (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Descarga
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{week.intensity}</p>
                    </div>
                    <button
                        onClick={handleRegenerate}
                        disabled={busy === 'regen'}
                        title="Sortear otros ejercicios para esta semana"
                        className="px-2.5 py-1.5 glass border border-border/50 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1.5 transition-colors"
                    >
                        {busy === 'regen' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Otros ejercicios
                    </button>
                </div>

                <p className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    {week.coach_note}
                </p>

                {week.rope && (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                        <Repeat className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            <strong>Soga esta semana:</strong> {week.rope.prescription}
                            <span className="block text-amber-300/70 mt-0.5">Variantes: {week.rope.variations.join(' · ')}</span>
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(weekProgress / week.days.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                        {weekProgress}/{week.days.length}
                    </span>
                </div>
            </div>

            {/* Días */}
            <div className="space-y-2.5">
                {week.days.map((day: any) => {
                    const key = `${selectedWeek}-${day.index}`
                    const done = doneSet.has(key)
                    const isOpen = openDay === day.index

                    return (
                        <div
                            key={day.index}
                            className={cn(
                                'glass rounded-2xl border overflow-hidden transition-colors',
                                done ? 'border-emerald-500/35 bg-emerald-950/10' : 'border-border/50'
                            )}
                        >
                            <div className="p-4 flex items-center gap-3">
                                <button
                                    onClick={() => toggleDone(day.index)}
                                    disabled={busy === key}
                                    className={cn(
                                        'w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
                                        done
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'border-border hover:border-emerald-500/60 text-transparent hover:text-emerald-500/40'
                                    )}
                                >
                                    {busy === key ? <Loader2 className="w-4 h-4 animate-spin text-foreground" /> : <Check className="w-4 h-4" />}
                                </button>

                                <button
                                    onClick={() => setOpenDay(isOpen ? null : day.index)}
                                    className="flex-1 min-w-0 text-left"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                            {DAY_NAMES[day.day_iso] || `Día ${day.index + 1}`}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{day.duration_min} min
                                        </span>
                                    </div>
                                    <h5 className={cn('text-sm font-bold mt-1', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                        {day.title}
                                    </h5>
                                    <p className="text-[11px] text-muted-foreground">{day.focus}</p>
                                </button>

                                <ChevronDown
                                    onClick={() => setOpenDay(isOpen ? null : day.index)}
                                    className={cn('w-4 h-4 text-muted-foreground shrink-0 cursor-pointer transition-transform', isOpen && 'rotate-180')}
                                />
                            </div>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 space-y-3">
                                            {day.blocks.map((block: any, blockIndex: number) => {
                                                const style = BLOCK_STYLE[block.type] || BLOCK_STYLE.principal
                                                const BlockIcon = style.icon
                                                return (
                                                    <div key={blockIndex} className={cn('rounded-xl border p-3 space-y-2', style.color)}>
                                                        <div className="flex items-center gap-1.5">
                                                            <BlockIcon className="w-3.5 h-3.5" />
                                                            <span className="text-[11px] font-bold uppercase tracking-wider">{block.name}</span>
                                                        </div>
                                                        {block.note && (
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">{block.note}</p>
                                                        )}

                                                        <div className="space-y-1.5">
                                                            {block.items.map((item: any, itemIndex: number) => {
                                                                const swapKey = `swap-${day.index}-${blockIndex}-${itemIndex}`
                                                                const swappable = block.type === 'principal'
                                                                return (
                                                                    <div
                                                                        key={itemIndex}
                                                                        className="bg-background/50 rounded-lg p-2.5 border border-border/40"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <span className="text-xs font-semibold text-foreground leading-snug">
                                                                                {item.name}
                                                                            </span>
                                                                            <span className="text-[11px] font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                                                                                {item.sets} × {item.reps}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                                                                            <span>{item.muscles}</span>
                                                                            {item.rest !== '—' && <span>· Pausa {item.rest}</span>}
                                                                            <span className="text-emerald-400/70">· {item.equipment}</span>
                                                                        </div>

                                                                        <p className="text-[10px] text-foreground/60 mt-1 italic leading-relaxed">{item.cue}</p>

                                                                        {swappable && (
                                                                            <button
                                                                                onClick={() => handleSwap(day.index, blockIndex, itemIndex)}
                                                                                disabled={busy === swapKey}
                                                                                className="mt-1.5 text-[10px] font-semibold text-muted-foreground hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                                                            >
                                                                                {busy === swapKey
                                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                                    : <Shuffle className="w-3 h-3" />}
                                                                                Cambiar por otro
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

            {/* Días de descanso */}
            <div className="glass p-3.5 rounded-xl border border-border/50 flex items-start gap-2.5 bg-secondary/20">
                <Moon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Los días que no aparecen son de descanso.</strong> Caminata, movilidad o nada.
                    El músculo crece cuando descansás, no cuando entrenás. Y las semanas de descarga (4, 8 y 12) son parte del plan:
                    si las saltás, llegás quemado a la semana 9.
                </p>
            </div>
        </div>
    )
}

function Stat({ value, label }: { value: any; label: string }) {
    return (
        <div>
            <span className="block text-base font-bold text-emerald-400 leading-none">{value}</span>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
        </div>
    )
}
