'use client'

import { useState } from 'react'
import {
    Wand2, Loader2, Target, CheckSquare, Flame, AlertTriangle,
    Check, Calendar, X, Ruler
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    suggestObjectives, createObjectiveFromSuggestion, type ObjectiveSuggestion
} from '@/lib/actions/okrs'
import { cn } from '@/lib/utils'

const TIMEFRAME_LABEL: Record<string, string> = {
    Year: 'Anual',
    Q1: 'Trimestre 1',
    Q2: 'Trimestre 2',
    Q3: 'Trimestre 3',
    Q4: 'Trimestre 4'
}

export function ObjectiveSuggester() {
    const router = useRouter()
    const [focus, setFocus] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [suggestions, setSuggestions] = useState<ObjectiveSuggestion[] | null>(null)
    const [creatingIdx, setCreatingIdx] = useState<number | null>(null)
    const [withTasks, setWithTasks] = useState(true)
    const [withHabits, setWithHabits] = useState(true)

    async function handleSuggest() {
        setLoading(true)
        setError('')
        try {
            const res = await suggestObjectives(focus.trim() || undefined)
            if (!res.ok) {
                setError(res.error)
                return
            }
            setSuggestions(res.data)
        } catch (e: any) {
            setError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(suggestion: ObjectiveSuggestion, idx: number) {
        setCreatingIdx(idx)
        const res = await createObjectiveFromSuggestion(suggestion, { withTasks, withHabits })
        setCreatingIdx(null)
        if ('error' in res && res.error) return alert(res.error)

        const parts = ['Objetivo creado']
        if (res.tasksCreated) parts.push(`${res.tasksCreated} tareas`)
        if (res.habitsCreated) parts.push(`${res.habitsCreated} hábitos`)
        alert(`${parts.join(' · ')}. Ya están enganchados al objetivo.`)

        setSuggestions(prev => (prev || []).filter((_, i) => i !== idx))
        router.refresh()
    }

    return (
        <div className="glass p-5 rounded-2xl border border-violet-500/25 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-violet-400" />
                        ¿Qué objetivo realista me conviene ponerme?
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Objetivos SMART sacados de tus datos reales, con sus resultados clave, tareas y hábitos.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <input
                        value={focus}
                        onChange={e => setFocus(e.target.value)}
                        placeholder="¿Algún foco? (opcional)"
                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white w-full lg:w-56 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                        onClick={handleSuggest}
                        disabled={loading}
                        className="px-4 py-2.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60 shrink-0"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {loading ? 'Pensando…' : 'Proponeme objetivos'}
                    </button>
                </div>
            </div>

            {error && (
                <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 leading-relaxed break-words">
                    No pude proponerte nada ahora: {error}
                </p>
            )}

            {suggestions && suggestions.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={withTasks}
                                onChange={e => setWithTasks(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-indigo-500"
                            />
                            <span className="text-[11px] text-muted-foreground">Crear también las tareas</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={withHabits}
                                onChange={e => setWithHabits(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-orange-500"
                            />
                            <span className="text-[11px] text-muted-foreground">Crear también los hábitos</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {suggestions.map((s, idx) => (
                            <div
                                key={idx}
                                className="p-4 rounded-2xl bg-secondary/40 border border-border/50 space-y-3 flex flex-col"
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-semibold">
                                            {TIMEFRAME_LABEL[s.timeframe] || s.timeframe}
                                        </span>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground">
                                            {s.type === 'Professional' ? 'Profesional' : 'Personal'}
                                        </span>
                                        {s.target_date && (
                                            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-2.5 h-2.5" />
                                                {s.target_date.split('-').reverse().join('/')}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-sm font-bold text-white leading-snug">{s.title}</h4>
                                    {s.description && (
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">{s.description}</p>
                                    )}
                                </div>

                                {s.key_results.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                            <Ruler className="w-2.5 h-2.5" /> Resultados clave
                                        </span>
                                        {s.key_results.map((kr, i) => (
                                            <div key={i} className="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                                                <p className="text-foreground">{kr.title}</p>
                                                <p className="text-emerald-400 font-mono text-[10px]">
                                                    {kr.current} → {kr.target} {kr.unit}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {s.why && (
                                    <p className="text-[11px] text-violet-300/90 leading-relaxed">{s.why}</p>
                                )}

                                {s.tasks.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                                            <CheckSquare className="w-2.5 h-2.5" /> {s.tasks.length} tareas
                                        </span>
                                        <ul className="space-y-0.5">
                                            {s.tasks.map((t, i) => (
                                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                                                    <span className="text-indigo-400 shrink-0">S{t.week}</span>
                                                    <span>{t.title}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {s.habits.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                                            <Flame className="w-2.5 h-2.5" /> {s.habits.length} hábitos
                                        </span>
                                        <ul className="space-y-0.5">
                                            {s.habits.map((h, i) => (
                                                <li key={i} className="text-[10px] text-muted-foreground">
                                                    {h.title} · {h.frequency_type === 'daily'
                                                        ? 'diario'
                                                        : `${h.frequency_times_per_week}× por semana`} · {h.estimated_minutes} min
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {s.risk && (
                                    <p className="text-[10px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 flex items-start gap-1.5">
                                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                        <span>{s.risk}</span>
                                    </p>
                                )}

                                {s.smart_notes && (
                                    <details className="text-[10px] text-muted-foreground">
                                        <summary className="cursor-pointer hover:text-foreground">Por qué es SMART</summary>
                                        <p className="pt-1 leading-relaxed">{s.smart_notes}</p>
                                    </details>
                                )}

                                <div className="flex gap-1.5 pt-1 mt-auto">
                                    <button
                                        onClick={() => handleCreate(s, idx)}
                                        disabled={creatingIdx === idx}
                                        className={cn(
                                            'flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold',
                                            'flex items-center justify-center gap-1 disabled:opacity-50'
                                        )}
                                    >
                                        {creatingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                                        Adoptarlo
                                    </button>
                                    <button
                                        onClick={() => setSuggestions(prev => (prev || []).filter((_, i) => i !== idx))}
                                        className="px-2.5 py-2 bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground rounded-lg"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <Check className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400" />
                        Al adoptarlo, las tareas se crean con fecha real según la semana del plan y los hábitos
                        quedan vinculados al objetivo.
                    </p>
                </>
            )}
        </div>
    )
}
