'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Check, ChevronDown, Clock, Loader2, SkipForward, RotateCcw, Zap, Footprints, Moon,
    Info, Baby, Timer, TreePine, Sun
} from 'lucide-react'
import { PARK_PLAN, type ParkProgress } from '@/lib/parkPlan'
import { logParkSession, skipParkSession, undoParkSession, restartParkPlan } from '@/lib/actions/park'
import { cn } from '@/lib/utils'

interface Props {
    logs: any[]
    progress: ParkProgress
}

const BLOCK_STYLE: Record<string, { color: string; icon: any }> = {
    calentamiento: { color: 'text-sky-400 border-sky-500/25 bg-sky-500/5', icon: Zap },
    principal: { color: 'text-lime-400 border-lime-500/25 bg-lime-500/5', icon: Footprints },
    vuelta_calma: { color: 'text-violet-400 border-violet-500/25 bg-violet-500/5', icon: Moon }
}

export function ParkPlanView({ logs, progress }: Props) {
    const router = useRouter()
    const [selectedWeek, setSelectedWeek] = useState(progress.currentWeek)
    const [openSession, setOpenSession] = useState<number | null>(0)
    const [busy, setBusy] = useState<string | null>(null)
    const [withJulian, setWithJulian] = useState(false)

    const week = PARK_PLAN.find(w => w.week === selectedWeek)!

    const logByKey = useMemo(() => {
        const map = new Map<string, any>()
        for (const l of logs) map.set(`${l.week_number}-${l.session_index}`, l)
        return map
    }, [logs])

    const doneThisWeek = week.sessions.filter(s => logByKey.get(`${selectedWeek}-${s.index}`)?.completed).length
    const julianCount = logs.filter(l => l.completed && l.with_julian).length

    async function run(key: string, fn: () => Promise<void>) {
        setBusy(key)
        try {
            await fn()
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setBusy(null)
        }
    }

    function handleRestart() {
        if (!confirm('¿Reiniciar el plan de parque? Se borran las sesiones registradas y volvés a la semana 1.')) return
        run('restart', async () => {
            await restartParkPlan()
            setSelectedWeek(1)
        })
    }

    return (
        <div className="space-y-5">
            {/* Resumen */}
            <div className="glass p-4 rounded-2xl border border-lime-500/20 bg-gradient-to-r from-lime-950/20 to-secondary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                            <TreePine className="w-4 h-4 text-lime-400" /> Plan de parque · Volver a jugar bien
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            8 semanas · 2 sesiones por semana · alternalo con los días de fuerza en casa
                        </p>
                    </div>
                    <div className="flex gap-4 text-center shrink-0">
                        <Stat value={progress.totalDone} label="sesiones hechas" />
                        <Stat value={`${progress.currentWeek}/8`} label="semana" />
                        {julianCount > 0 && <Stat value={julianCount} label="con Julian" />}
                    </div>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed pt-3 border-t border-border/40 space-y-1">
                    <p className="flex items-start gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Con calor fuerte, evitá de 14 a 16 h: buscá sombra, llevá agua o salí después de las 18.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-lime-400 shrink-0 mt-0.5" />
                        <span><strong className="text-foreground">Regla de los 10 minutos:</strong> si no hay ganas, hacé la versión mínima. Cuenta igual. La sesión que mata el plan es la que no hacés, no la floja.</span>
                    </p>
                </div>
                <button
                    onClick={handleRestart}
                    disabled={busy === 'restart'}
                    className="px-2.5 py-1.5 glass border border-border/50 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                    {busy === 'restart' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Reiniciar plan de parque
                </button>
            </div>

            {/* Selector de semanas */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {PARK_PLAN.map(w => {
                    const active = w.week === selectedWeek
                    const complete = (progress.doneByWeek[w.week] || 0) >= w.sessions.length
                    return (
                        <button
                            key={w.week}
                            onClick={() => { setSelectedWeek(w.week); setOpenSession(0) }}
                            className={cn(
                                'shrink-0 w-[60px] py-2 rounded-xl border text-center transition-all',
                                active
                                    ? 'bg-lime-600 border-lime-500 text-white'
                                    : complete
                                        ? 'bg-lime-500/10 border-lime-500/30 text-lime-300'
                                        : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground',
                                w.week === progress.currentWeek && !active && 'ring-1 ring-amber-500/50'
                            )}
                        >
                            <span className="block text-[9px] opacity-70 leading-none">SEM</span>
                            <span className="block text-sm font-bold leading-tight">{w.week}</span>
                            <span className="block text-[8px] leading-none opacity-80">{w.phase}</span>
                        </button>
                    )
                })}
            </div>

            {/* Cabecera de la semana */}
            <div className="glass p-4 rounded-2xl border border-border/50 space-y-2">
                <h4 className="text-sm font-bold text-foreground">Semana {week.week} · {week.phase}: {week.goal}</h4>
                <p className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-lime-400 shrink-0 mt-0.5" />
                    {week.coach_note}
                </p>
                <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-lime-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(doneThisWeek / week.sessions.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                        {doneThisWeek}/{week.sessions.length}
                    </span>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 cursor-pointer select-none w-fit">
                    <input
                        type="checkbox"
                        checked={withJulian}
                        onChange={e => setWithJulian(e.target.checked)}
                        className="accent-lime-500"
                    />
                    <Baby className="w-3.5 h-3.5 text-pink-400" /> La próxima que marque la hago con Julian
                </label>
            </div>

            {/* Sesiones */}
            <div className="space-y-2.5">
                {week.sessions.map(session => {
                    const key = `${selectedWeek}-${session.index}`
                    const log = logByKey.get(key)
                    const done = !!log?.completed
                    const skipped = !!log?.skipped && !done
                    const isOpen = openSession === session.index

                    return (
                        <div
                            key={session.index}
                            className={cn(
                                'glass rounded-2xl border overflow-hidden transition-colors',
                                done ? 'border-lime-500/35 bg-lime-950/10' : skipped ? 'border-border/40 bg-secondary/20' : 'border-border/50'
                            )}
                        >
                            <div className="p-4 flex items-center gap-3">
                                <button
                                    onClick={() => run(key, () => done
                                        ? undoParkSession(selectedWeek, session.index)
                                        : logParkSession({ weekNumber: selectedWeek, sessionIndex: session.index, withJulian }))}
                                    disabled={busy === key}
                                    title={done ? 'Deshacer' : 'Marcar como hecha'}
                                    className={cn(
                                        'w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
                                        done
                                            ? 'bg-lime-500 border-lime-500 text-white'
                                            : 'border-border hover:border-lime-500/60 text-transparent hover:text-lime-500/40'
                                    )}
                                >
                                    {busy === key ? <Loader2 className="w-4 h-4 animate-spin text-foreground" /> : <Check className="w-4 h-4" />}
                                </button>

                                <button onClick={() => setOpenSession(isOpen ? null : session.index)} className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{session.duration_min} min
                                        </span>
                                        {log?.minimum && done && <Badge>Versión mínima</Badge>}
                                        {log?.with_julian && done && <Badge>Con Julian</Badge>}
                                        {skipped && <Badge>Salteada</Badge>}
                                    </div>
                                    <h5 className={cn('text-sm font-bold mt-1', done || skipped ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                        {session.title}
                                    </h5>
                                    <p className="text-[11px] text-muted-foreground">{session.focus}</p>
                                </button>

                                {!done && !skipped && (
                                    <button
                                        onClick={() => run(`skip-${key}`, () => skipParkSession(selectedWeek, session.index))}
                                        disabled={busy === `skip-${key}`}
                                        title="Saltearla para que el plan pueda avanzar"
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 shrink-0 transition-colors"
                                    >
                                        {busy === `skip-${key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                                {skipped && (
                                    <button
                                        onClick={() => run(key, () => undoParkSession(selectedWeek, session.index))}
                                        title="Volver a dejarla pendiente"
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                <ChevronDown
                                    onClick={() => setOpenSession(isOpen ? null : session.index)}
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
                                            {session.blocks.map((block, bi) => {
                                                const style = BLOCK_STYLE[block.type]
                                                const Icon = style.icon
                                                return (
                                                    <div key={bi} className={cn('rounded-xl border p-3 space-y-2', style.color)}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Icon className="w-3.5 h-3.5" />
                                                            <span className="text-[11px] font-bold uppercase tracking-wider">{block.name}</span>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {block.items.map((item, ii) => (
                                                                <div key={ii} className="bg-background/50 rounded-lg p-2.5 border border-border/40">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <span className="text-xs font-semibold text-foreground leading-snug">{item.name}</span>
                                                                        <span className="text-[11px] font-bold text-lime-400 shrink-0 whitespace-nowrap">{item.dose}</span>
                                                                    </div>
                                                                    {item.cue && <p className="text-[10px] text-foreground/60 mt-1 italic leading-relaxed">{item.cue}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] space-y-2">
                                                <p className="text-amber-300/90"><strong>Versión mínima:</strong> {session.minimum}</p>
                                                {!done && (
                                                    <button
                                                        onClick={() => run(`min-${key}`, () => logParkSession({
                                                            weekNumber: selectedWeek, sessionIndex: session.index, minimum: true, withJulian
                                                        }))}
                                                        disabled={busy === `min-${key}`}
                                                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1.5 hover:bg-amber-500/25 transition-colors"
                                                    >
                                                        {busy === `min-${key}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Timer className="w-3 h-3" />}
                                                        Hice la versión mínima
                                                    </button>
                                                )}
                                            </div>

                                            <div className="rounded-xl border border-pink-500/25 bg-pink-500/5 p-3 text-[11px] text-pink-200/90 flex items-start gap-1.5">
                                                <Baby className="w-3.5 h-3.5 shrink-0 mt-0.5 text-pink-400" />
                                                <span><strong>Con Julian:</strong> {session.with_julian}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
            {children}
        </span>
    )
}

function Stat({ value, label }: { value: any; label: string }) {
    return (
        <div>
            <span className="block text-base font-bold text-lime-400 leading-none">{value}</span>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
        </div>
    )
}
