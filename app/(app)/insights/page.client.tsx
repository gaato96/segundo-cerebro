'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { interpretInsights, type Correlation } from '@/lib/actions/insights'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

interface Props {
    correlations: Correlation[]
    weeks: { week: string; mood: number | null; training: number; habits: number; commitments: number }[]
    coverage: { days: number; moodDays: number; trainedDays: number; commitmentDays: number; eveningDays: number; activeHabits: number }
}

/** Cada dato es una pregunta con su respuesta, no un tablero de numeritos. */
export function InsightsPageClient({ correlations, weeks, coverage }: Props) {
    const [reading, setReading] = useState('')
    const [loading, setLoading] = useState(false)
    const ready = correlations.filter(c => c.reliable), waiting = correlations.filter(c => !c.reliable)
    const withMood = weeks.filter(w => w.mood !== null)
    const maxT = Math.max(1, ...weeks.map(w => w.training))

    async function interpret() {
        setLoading(true)
        try { setReading(await interpretInsights()) } catch (e: any) { setReading(`No pude interpretarlo: ${e?.message}`) } finally { setLoading(false) }
    }

    return (
        <PageShell wide>
            <PageHeader label={`Sistema · últimos ${coverage.days} días`} title="Indicadores" subtitle="Preguntas que solo se responden teniendo todo en el mismo lugar."
                actions={<button onClick={interpret} disabled={loading || !ready.length} className="btn-primary text-sm">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} ¿Qué hago con esto?</button>} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 min-w-0">
                    {reading && <Panel lamp className="mb-8"><SectionLabel>Lectura del Copiloto</SectionLabel><p className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-[65ch]">{reading}</p></Panel>}
                    {ready.length === 0 && <p className="text-muted-foreground max-w-[60ch] pb-8">Todavía no hay días suficientes para comparar. Se llena solo: cerrá el día, entrená y tildá hábitos; con 4 días de cada lado aparece la primera respuesta.</p>}
                    <div className="divide-y divide-hairline">
                        {[...ready, ...waiting].map(c => {
                            const max = Math.max(c.withValue || 0, c.withoutValue || 0, 0.001)
                            const strong = c.reliable && c.delta !== null && Math.abs(c.delta) >= 8
                            return (
                                <section key={c.id} className={cn('py-7 first:pt-0', !c.reliable && 'opacity-60')}>
                                    <div className="flex items-start gap-4"><h2 className="flex-1 text-lg md:text-xl font-semibold leading-snug max-w-[40ch]">{c.question}</h2>{strong && <span className={cn('font-mono text-sm', c.delta! > 0 ? 'text-emerald-300' : 'text-red-300')}>{c.delta! > 0 ? '+' : ''}{c.delta}%</span>}</div>
                                    <div className="mt-4 space-y-2.5">
                                        {([[c.withLabel, c.withValue, c.withSample, true], [c.withoutLabel, c.withoutValue, c.withoutSample, false]] as [string, number | null, number, boolean][]).map(([l, v, n, main]) => (
                                            <div key={l} className="grid grid-cols-[minmax(0,130px)_1fr_auto] sm:grid-cols-[180px_1fr_80px] items-center gap-3 text-sm">
                                                <span className="text-muted-foreground truncate">{l} <span className="font-mono text-[11px] text-ink-faint">{n}d</span></span>
                                                <span className="h-5 rounded bg-raised/50 overflow-hidden"><span className={cn('block h-full rounded', main ? 'bg-graphite-200' : 'bg-graphite-500')} style={{ width: `${v === null ? 0 : Math.max(2, (v / max) * 100)}%` }} /></span>
                                                <span className="font-mono text-right">{v === null ? '—' : `${v}${c.unit}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-3 max-w-[65ch]">{c.reading}</p>
                                </section>
                            )
                        })}
                        {withMood.length >= 3 && (
                            <section className="py-7">
                                <h2 className="text-lg md:text-xl font-semibold">¿Cómo vienen tu ánimo y tu entrenamiento?</h2>
                                <div className="grid mt-5 gap-1.5 items-end" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
                                    {weeks.map(w => <div key={w.week} title={`${w.week}: ánimo ${w.mood ?? 'sin dato'}, ${w.training} entrenamientos`}><div className="relative h-32 border-b border-hairline"><span className="absolute bottom-0 inset-x-[20%] rounded-t bg-emerald-400/30" style={{ height: `${(w.training / maxT) * 50}%` }} />{w.mood !== null && <span className="absolute left-1/2 w-2.5 h-2.5 -ml-[5px] rounded-full bg-amber-400" style={{ bottom: `calc(${((w.mood - 1) / 4) * 90}% )` }} />}</div><span className="block text-center font-mono text-[10px] text-ink-faint mt-1">{w.week.slice(8, 10)}/{w.week.slice(5, 7)}</span></div>)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-3">Punto: ánimo promedio de 1 a 5. Barra: sesiones por semana.</p>
                            </section>
                        )}
                    </div>
                </div>
                <aside className="lg:col-span-4 space-y-4">
                    <Panel><SectionLabel>Con qué datos</SectionLabel><dl className="divide-y divide-hairline text-sm">{([['Días con ánimo', coverage.moodDays], ['Días entrenados', coverage.trainedDays], ['Días planificados', coverage.commitmentDays], ['Días cerrados', coverage.eveningDays], ['Hábitos activos', coverage.activeHabits]] as [string, number][]).map(([l, v]) => <div key={l} className="flex justify-between py-2"><dt className="text-muted-foreground">{l}</dt><dd className="font-mono">{v}</dd></div>)}</dl></Panel>
                    <Panel><SectionLabel>Cómo leerlo</SectionLabel><p className="text-sm text-muted-foreground">Son coincidencias, no causas. Si tu ánimo es mejor los días que entrenás, puede ser que entrenar ayude o que entrenes cuando ya estás bien. Sirve para decidir qué probar.</p></Panel>
                </aside>
            </div>
        </PageShell>
    )
}
