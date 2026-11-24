'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check as CheckIcon, RefreshCw, Shuffle, Loader2, ChevronDown, RotateCcw, SkipForward, AlertTriangle } from 'lucide-react'
import { logTrainingSession, undoTrainingSession, regenerateWeek, swapExercise, skipTrainingSession, restartTrainingPlan, setPlanProgressMode } from '@/lib/actions/training'
import type { PlanProgress } from '@/lib/trainingProgress'
import { SectionLabel } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** La sesión que toca, iluminada, con series para tildar. Abajo, las 12 semanas. */
export function TrainingPlanView({ plan, logs, progress }: { plan: any; logs: any[]; progress: PlanProgress }) {
    const router = useRouter()
    const weeks: any[] = plan?.plan_data?.weeks || []
    const [selected, setSelected] = useState(progress.currentWeek)
    const [openDay, setOpenDay] = useState<number | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [sets, setSets] = useState<Record<string, boolean>>({})
    const key = `sc-sets-${plan.id}`

    useEffect(() => { try { setSets(JSON.parse(localStorage.getItem(key) || '{}')) } catch { } }, [key])
    useEffect(() => { setSelected(progress.currentWeek) }, [progress.currentWeek])
    const done = useMemo(() => new Set(logs.filter(l => l.completed).map(l => `${l.week_number}-${l.day_index}`)), [logs])
    const skipped = useMemo(() => new Set(logs.filter(l => l.skipped && !l.completed).map(l => `${l.week_number}-${l.day_index}`)), [logs])

    const week = weeks.find(w => w.week === selected)
    if (!week) return <p className="text-sm text-muted-foreground">No se encontró la semana {selected} en el plan.</p>
    const id = (d: any) => `${selected}-${d.index}`
    const next = week.days.find((d: any) => !done.has(id(d)) && !skipped.has(id(d)))

    async function run(k: string, fn: () => Promise<unknown>) {
        setBusy(k)
        try { await fn(); router.refresh() } catch (e: any) { alert(e?.message || 'No se pudo guardar.') } finally { setBusy(null) }
    }
    function tick(k: string) {
        setSets(s => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem(key, JSON.stringify(n)) } catch { } return n })
    }
    async function restart() {
        if (!confirm('¿Reiniciar el plan desde hoy en la semana 1? Las sesiones registradas se conservan.')) return
        await run('restart', () => restartTrainingPlan(plan.id, { startFrom: 'today', keepLogs: true }))
        setSelected(1)
    }

    const Blocks = ({ day }: { day: any }) => (
        <div className="space-y-6 mt-5">
            {day.blocks.map((b: any, bi: number) => (
                <section key={bi}>
                    <SectionLabel>{b.name}</SectionLabel>
                    {b.note && <p className="text-sm text-muted-foreground mb-3 max-w-[65ch]">{b.note}</p>}
                    <ol className="divide-y divide-hairline rounded-xl bg-background/30 border border-hairline">
                        {b.items.map((it: any, ii: number) => {
                            const n = Math.min(8, Number(String(it.sets).match(/\d+/)?.[0]) || 1)
                            const sk = `swap-${day.index}-${bi}-${ii}`
                            return (
                                <li key={ii} className="px-4 py-3">
                                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                                        <span className="font-mono text-xs text-ink-faint pt-0.5">{String(ii + 1).padStart(2, '0')}</span>
                                        <div className="flex-1 min-w-[170px]"><p className="text-sm font-medium">{it.name}</p><p className="font-mono text-xs text-muted-foreground mt-0.5">{it.sets} × {it.reps}{it.rest && it.rest !== '—' ? ` · pausa ${it.rest}` : ''}</p></div>
                                        <div className="flex flex-wrap gap-1">{Array.from({ length: n }, (_, s) => { const k = `${id(day)}-${bi}-${ii}-${s}`; return <button key={s} onClick={() => tick(k)} aria-pressed={!!sets[k]} aria-label={`Serie ${s + 1}`} className={cn('h-9 min-w-[38px] px-2 rounded-lg border font-mono text-[11px]', sets[k] ? 'bg-emerald-400 border-emerald-400 text-background' : 'border-hairline text-muted-foreground')}>S{s + 1}</button> })}</div>
                                    </div>
                                    <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer min-h-[28px] flex items-center">Cómo se hace</summary><p className="max-w-[60ch] pb-1">{it.cue}</p><p>{it.muscles} · {it.equipment}</p>{b.type === 'principal' && <button onClick={() => run(sk, () => swapExercise(plan.id, selected, day.index, bi, ii))} disabled={busy === sk} className="mt-2 h-9 inline-flex items-center gap-1.5 hover:text-foreground">{busy === sk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />} Cambiar ejercicio</button>}</details>
                                </li>
                            )
                        })}
                    </ol>
                </section>
            ))}
        </div>
    )

    return (
        <div className="space-y-8">
            {progress.mode === 'adaptive' && progress.weeksBehind > 0 && <p className="flex gap-3 rounded-xl border border-hairline px-4 py-3 text-sm text-muted-foreground"><AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />Vas por la semana {progress.currentWeek}; por calendario tocaría la {progress.calendarWeek}. El plan te espera: hacé o salteá lo que falta.</p>}
            {progress.finished && <p className="rounded-xl border border-hairline px-4 py-3 text-sm">Terminaste las 12 semanas. Generá un plan nuevo con tu perfil actualizado.</p>}

            {next ? (
                <section className="lamp rounded-2xl p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div><p className="label-caps !text-amber-300">{selected === progress.currentWeek ? 'La sesión que sigue' : `Semana ${selected}`} · {DAYS[next.day_iso] || `día ${next.index + 1}`}</p><h2 className="text-xl font-semibold mt-1">{next.title} <span className="font-mono text-sm text-muted-foreground">{next.duration_min} min</span></h2><p className="text-sm text-muted-foreground mt-1">{next.focus}</p></div>
                        <div className="flex gap-2"><button onClick={() => run(`skip-${next.index}`, () => skipTrainingSession(plan.id, selected, next.index))} disabled={!!busy} className="btn-secondary text-sm"><SkipForward className="w-4 h-4" /> Saltear</button><button onClick={() => run(id(next), () => logTrainingSession({ planId: plan.id, weekNumber: selected, dayIndex: next.index }))} disabled={!!busy} className="btn-primary text-sm">{busy === id(next) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />} Sesión hecha</button></div>
                    </div>
                    <Blocks day={next} />
                </section>
            ) : <p className="rounded-2xl border border-hairline bg-card px-5 py-6 text-sm">Semana {selected} resuelta. {selected < weeks.length ? 'Elegí la próxima abajo.' : ''}</p>}

            <section>
                <SectionLabel right={`semana ${selected} de ${weeks.length}`}>Las 12 semanas</SectionLabel>
                <div className="grid grid-cols-6 lg:grid-cols-12 gap-1.5">
                    {weeks.map(w => {
                        const n = w.days.filter((d: any) => done.has(`${w.week}-${d.index}`)).length
                        return <button key={w.week} onClick={() => { setSelected(w.week); setOpenDay(null) }} aria-pressed={w.week === selected} className={cn('rounded-lg p-2 text-left border', w.week === selected ? 'border-[hsl(var(--hairline-strong))] bg-raised' : 'border-transparent hover:bg-card')}><span className={cn('block h-1.5 rounded-full mb-1.5', n === w.days.length ? 'bg-emerald-400' : w.week === progress.currentWeek ? 'bg-amber-400' : n > 0 ? 'bg-emerald-400/50' : 'bg-raised')} /><span className="font-mono text-[11px] text-muted-foreground block">S{String(w.week).padStart(2, '0')}</span><span className="font-mono text-[10px] text-ink-faint">{n}/{w.days.length}{w.deload ? ' · desc.' : ''}</span></button>
                    })}
                </div>
            </section>

            <section>
                <SectionLabel right={<button onClick={() => { if (confirm(`¿Sortear otros ejercicios para la semana ${selected}?`)) run('regen', () => regenerateWeek(plan.id, selected)) }} disabled={!!busy} className="inline-flex items-center gap-1.5 hover:text-foreground min-h-[32px]"><RefreshCw className={cn('w-3.5 h-3.5', busy === 'regen' && 'animate-spin')} /> otros ejercicios</button>}>Semana {week.week} · {week.block}</SectionLabel>
                <p className="text-sm text-muted-foreground max-w-[70ch] mb-3">{week.intensity} {week.coach_note}</p>
                {week.rope && <p className="text-sm text-muted-foreground max-w-[70ch] mb-3"><span className="text-foreground">Soga:</span> {week.rope.prescription}</p>}
                <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                    {week.days.map((d: any) => {
                        const k = id(d), isDone = done.has(k), isSkip = skipped.has(k), open = openDay === d.index
                        return <div key={d.index} className="px-4">
                            <div className="flex items-center gap-3 min-h-[60px]">
                                <button onClick={() => run(k, () => isDone || isSkip ? undoTrainingSession(plan.id, selected, d.index) : logTrainingSession({ planId: plan.id, weekNumber: selected, dayIndex: d.index }))} disabled={!!busy} aria-label={isDone ? 'Desmarcar' : isSkip ? 'Volver a pendiente' : 'Marcar hecha'} className={cn('w-6 h-6 rounded-md border flex items-center justify-center', isDone ? 'bg-emerald-400 border-emerald-400 text-background' : 'border-[hsl(var(--hairline-strong))]')}>{busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isDone ? <CheckIcon className="w-3.5 h-3.5" /> : isSkip ? <RotateCcw className="w-3 h-3 text-muted-foreground" /> : null}</button>
                                <button onClick={() => setOpenDay(open ? null : d.index)} aria-expanded={open} className="flex-1 min-w-0 text-left flex items-center gap-3 py-3"><span className="flex-1 min-w-0"><span className={cn('block text-sm truncate', (isDone || isSkip) && 'text-muted-foreground line-through')}>{d.title}</span><span className="block font-mono text-[11px] text-muted-foreground">{DAYS[d.day_iso] || `Día ${d.index + 1}`} · {d.duration_min} min{isSkip ? ' · salteada' : ''}</span></span><ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} /></button>
                            </div>
                            {open && <div className="pb-5"><Blocks day={d} /></div>}
                        </div>
                    })}
                </div>
            </section>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-hairline text-xs text-muted-foreground">
                <button onClick={() => run('mode', () => setPlanProgressMode(plan.id, progress.mode === 'adaptive' ? 'calendar' : 'adaptive'))} disabled={!!busy} className="h-10 px-3 rounded-lg border border-hairline hover:text-foreground">{progress.mode === 'adaptive' ? 'Avanza cuando completás' : 'Avanza con el calendario'}</button>
                <button onClick={restart} disabled={!!busy} className="h-10 px-3 rounded-lg border border-hairline hover:text-foreground">Reiniciar plan</button>
                <span className="self-center">Los días que no aparecen son de descanso.</span>
            </div>
        </div>
    )
}
