'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, Loader2, MoveRight, Check } from 'lucide-react'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { carryOverToTomorrow } from '@/lib/actions/morning_ritual'
import { cn } from '@/lib/utils'

interface Props {
    date: string
    focus: string | null
    tasks: { id: string; title: string; status: string }[]
    /** "close" = cierre del día: ofrece pasar lo pendiente a mañana. */
    mode?: 'day' | 'close'
    /** Foco de mañana si ya quedó escrito (solo en el cierre). */
    tomorrowFocus?: string | null
}

/** El foco del día (una línea + hasta 3 tareas), con lo que salió del plan de la mañana. */
export function DayFocusWidget({ date, focus, tasks: initialTasks, mode = 'day', tomorrowFocus }: Props) {
    const router = useRouter()
    const [tasks, setTasks] = useState(initialTasks)
    const [nextFocus, setNextFocus] = useState(tomorrowFocus || '')
    const [moving, setMoving] = useState(false)
    const [moved, setMoved] = useState<number | null>(null)

    const done = tasks.filter(t => t.status === 'Done').length
    const pending = tasks.length - done
    const planned = !!focus || tasks.length > 0

    async function toggle(id: string, status: string) {
        const next = status === 'Done' ? 'Todo' : 'Done'
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: next } : t)))
        await updateTaskStatus(id, next)
    }

    async function handleCarry() {
        setMoving(true)
        const res = await carryOverToTomorrow(date, nextFocus)
        setMoving(false)
        if (res.error) return alert(res.error)
        setMoved(res.moved ?? 0)
        router.refresh()
    }

    return (
        <div className="lamp rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground leading-tight">
                            {mode === 'close' ? 'El foco de hoy' : 'Foco de hoy'}
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                            {planned ? `${done} de ${tasks.length} hechas` : 'Todavía no planificaste el día'}
                        </p>
                    </div>
                </div>
            </div>

            {planned ? (
                <>
                    {focus && <p className="text-xl font-semibold text-foreground leading-snug">{focus}</p>}
                    <div className="space-y-1.5">
                        {tasks.map((t, i) => {
                            const isDone = t.status === 'Done'
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => toggle(t.id, t.status)}
                                    className={cn(
                                        'w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors',
                                        isDone ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-secondary/40 border-border/50 hover:bg-secondary/60'
                                    )}
                                >
                                    <span className={cn('w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                                        isDone ? 'bg-emerald-600 border-emerald-500 text-white' : i === 0 ? 'border-amber-400/70' : 'border-white/20')}>
                                        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                                    </span>
                                    <span className={cn('text-sm flex-1 min-w-0', isDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                        {t.title}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </>
            ) : (
                <Link
                    href="/ritual"
                    className="w-full py-2.5 bg-primary text-primary-foreground hover:brightness-105 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                    Planificar el día <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            )}

            {mode === 'close' && (
                <div className="pt-3 border-t border-border/40 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Foco de mañana (opcional)</label>
                    <input
                        value={nextFocus}
                        onChange={e => setNextFocus(e.target.value)}
                        placeholder="Una línea. A la mañana arrancás con esto."
                        className="field w-full"
                    />
                    {moved !== null ? (
                        <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            {moved > 0 ? `${moved} ${moved === 1 ? 'tarea pasó' : 'tareas pasaron'} a mañana.` : 'Listo, mañana queda preparado.'}
                        </p>
                    ) : (
                        <button
                            onClick={handleCarry}
                            disabled={moving || (!pending && !nextFocus.trim())}
                            className="btn-secondary w-full justify-center disabled:opacity-40"
                        >
                            {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoveRight className="w-3.5 h-3.5" />}
                            {pending > 0 ? `Pasar ${pending} pendiente${pending === 1 ? '' : 's'} a mañana` : 'Guardar foco de mañana'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
