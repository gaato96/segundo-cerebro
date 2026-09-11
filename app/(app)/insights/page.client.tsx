'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Sparkles, Loader2, Info, Database } from 'lucide-react'
import { interpretInsights } from '@/lib/actions/insights'
import { cn } from '@/lib/utils'
import type { Correlation } from '@/lib/actions/insights'

interface Props {
    correlations: Correlation[]
    weeks: { week: string; mood: number | null; training: number; habits: number; commitments: number }[]
    coverage: {
        days: number
        moodDays: number
        trainedDays: number
        commitmentDays: number
        eveningDays: number
        activeHabits: number
    }
}

export function InsightsPageClient({ correlations, weeks, coverage }: Props) {
    const [reading, setReading] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const reliable = correlations.filter(c => c.reliable)

    async function handleInterpret() {
        setLoading(true)
        try {
            setReading(await interpretInsights())
        } catch (e: any) {
            setReading(`No pude interpretarlo: ${e?.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 animate-fade-in pb-24">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Indicadores</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Lo que solo puede responder tener todo en la misma base.
                    </p>
                </div>
                <button
                    onClick={handleInterpret}
                    disabled={loading || !reliable.length}
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Qué haría con esto
                </button>
            </div>

            {/* Aviso metodológico: importa más que los números */}
            <div className="glass p-4 rounded-2xl border border-border/50 flex gap-3">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Esto son <strong className="text-foreground">correlaciones, no causas</strong>. Que tu ánimo sea
                    mejor los días que entrenás puede significar que entrenar te levanta el ánimo, o que entrenás
                    los días que ya te sentías bien. Sirven para decidir qué probar, no para concluir.
                </p>
            </div>

            {/* Cobertura */}
            <div className="glass p-4 rounded-2xl border border-border/50 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Database className="w-3 h-3" /> Datos de los últimos {coverage.days} días
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <Coverage value={coverage.moodDays} label="con ánimo" />
                    <Coverage value={coverage.trainedDays} label="entrenados" />
                    <Coverage value={coverage.commitmentDays} label="con compromiso" />
                    <Coverage value={coverage.eveningDays} label="cerrados" />
                    <Coverage value={coverage.activeHabits} label="hábitos activos" />
                </div>
            </div>

            {reading && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-4 rounded-2xl border border-violet-500/25 bg-violet-950/10"
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 block mb-1.5">
                        Lectura del Copiloto
                    </span>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{reading}</p>
                </motion.div>
            )}

            {/* Correlaciones */}
            <div className="space-y-3">
                {correlations.map(c => <CorrelationCard key={c.id} correlation={c} />)}
            </div>

            {/* Tendencia semanal */}
            <WeeklyTrend weeks={weeks} />
        </div>
    )
}

function Coverage({ value, label }: { value: number; label: string }) {
    return (
        <div className="p-2 rounded-xl bg-secondary/40 border border-border/40 text-center">
            <span className="block text-sm font-bold text-foreground leading-none">{value}</span>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-wider mt-1">{label}</span>
        </div>
    )
}

function CorrelationCard({ correlation: c }: { correlation: Correlation }) {
    const max = Math.max(c.withValue || 0, c.withoutValue || 0, 0.001)
    const better = (c.delta ?? 0) > 0

    return (
        <div className={cn(
            'glass p-4 rounded-2xl border space-y-3',
            c.reliable ? 'border-border/50' : 'border-dashed border-border/40 opacity-70'
        )}>
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-xs font-bold text-foreground leading-snug">{c.question}</h3>
                {c.reliable && c.delta !== null && Math.abs(c.delta) >= 8 && (
                    <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                        better
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                            : 'text-red-400 bg-red-500/10 border-red-500/25'
                    )}>
                        {better ? '+' : ''}{c.delta}%
                    </span>
                )}
            </div>

            <div className="space-y-2">
                <Bar
                    label={`Días ${c.withLabel}`}
                    value={c.withValue}
                    unit={c.unit}
                    sample={c.withSample}
                    pct={c.withValue !== null ? (c.withValue / max) * 100 : 0}
                    color="bg-indigo-500"
                />
                <Bar
                    label={`Días ${c.withoutLabel}`}
                    value={c.withoutValue}
                    unit={c.unit}
                    sample={c.withoutSample}
                    pct={c.withoutValue !== null ? (c.withoutValue / max) * 100 : 0}
                    color="bg-muted-foreground/40"
                />
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">{c.reading}</p>
        </div>
    )
}

function Bar({ label, value, unit, sample, pct, color }: {
    label: string; value: number | null; unit: string; sample: number; pct: number; color: string
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground truncate">{label} <span className="opacity-60">(n={sample})</span></span>
                <span className="text-foreground font-semibold shrink-0 ml-2">
                    {value === null ? 'sin datos' : `${value}${unit}`}
                </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    className={cn('h-full rounded-full', color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct, value === null ? 0 : 3)}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>
        </div>
    )
}

function WeeklyTrend({ weeks }: { weeks: Props['weeks'] }) {
    const withMood = weeks.filter(w => w.mood !== null)
    if (withMood.length < 3) {
        return (
            <div className="glass p-5 rounded-2xl border border-dashed border-border/50 text-center">
                <LineChart className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                    Con 3 semanas de ánimo registrado aparece acá la tendencia. Se carga sola cuando cerrás el día.
                </p>
            </div>
        )
    }

    const W = 700
    const H = 160
    const PAD = 24
    const maxTraining = Math.max(...weeks.map(w => w.training), 1)

    const points = weeks.map((w, i) => {
        const x = PAD + (i / Math.max(weeks.length - 1, 1)) * (W - PAD * 2)
        const y = w.mood === null ? null : H - PAD - ((w.mood - 1) / 4) * (H - PAD * 2)
        return { x, y, ...w }
    })

    const path = points
        .filter(p => p.y !== null)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y!.toFixed(1)}`)
        .join(' ')

    return (
        <div className="glass p-4 rounded-2xl border border-border/50 space-y-3">
            <div>
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <LineChart className="w-3.5 h-3.5 text-indigo-400" />
                    Ánimo y entrenamiento, semana a semana
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                    Línea: ánimo promedio (1 a 5). Barras: sesiones de entrenamiento.
                </p>
            </div>

            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px] h-[160px]">
                    {[1, 2, 3, 4, 5].map(v => {
                        const y = H - PAD - ((v - 1) / 4) * (H - PAD * 2)
                        return (
                            <g key={v}>
                                <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
                                <text x={4} y={y + 3} fontSize={9} fill="currentColor" fillOpacity={0.35}>{v}</text>
                            </g>
                        )
                    })}

                    {points.map((p, i) => {
                        const barH = (p.training / maxTraining) * (H - PAD * 2) * 0.5
                        return (
                            <rect
                                key={`bar-${i}`}
                                x={p.x - 7}
                                y={H - PAD - barH}
                                width={14}
                                height={Math.max(barH, 0)}
                                rx={3}
                                className="fill-emerald-500/25"
                            />
                        )
                    })}

                    {path && <path d={path} fill="none" className="stroke-indigo-400" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}

                    {points.filter(p => p.y !== null).map((p, i) => (
                        <circle key={`dot-${i}`} cx={p.x} cy={p.y!} r={3} className="fill-indigo-400" />
                    ))}
                </svg>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-indigo-400 rounded-full" /> Ánimo
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-2 bg-emerald-500/25 rounded-sm" /> Entrenamientos
                </span>
                <span className="ml-auto">Últimas 12 semanas</span>
            </div>
        </div>
    )
}
