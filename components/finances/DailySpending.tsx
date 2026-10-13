'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Sparkles, Loader2, AlertTriangle, Bug, CalendarDays, Lightbulb, ArrowRight,
    Target, Trash2, Zap, Repeat, TrendingUp, TrendingDown, Check
} from 'lucide-react'
import {
    summarize, compareCategories, rangeFor, previousRange, daysInMonthOf, RANGE_LABELS,
    type ExpenseRecord, type RangeKind
} from '@/lib/spendingMath'
import { getCategory, getPaymentMethod, NECESSITY_LEVELS } from '@/lib/expenseCategories'
import { analyzeSpending, saveMoneyPlan, type MoneyPlanRow, type SpendingAnalysis } from '@/lib/actions/expenses'
import { deleteTransaction } from '@/lib/actions/finances'
import { QuickExpenseTrigger } from './QuickExpenseButton'
import { formatCurrency as formatARS, cn } from '@/lib/utils'

/** Sin centavos: en promedios y proyecciones solo meten ruido. */
const formatCurrency = (x: number) => formatARS(Math.round(x))

interface Props {
    records: ExpenseRecord[]
    plan: MoneyPlanRow | null
    today: string
}

const WEEKDAY_FULL: Record<number, string> = { 0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábados' }

function shortDate(date: string): string {
    const [, m, d] = date.split('-')
    return `${Number(d)}/${Number(m)}`
}

function dayLabel(date: string, today: string): string {
    if (date === today) return 'Hoy'
    const [y, m, d] = today.split('-').map(Number)
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
    if (date === yesterday) return 'Ayer'
    const [yy, mm, dd] = date.split('-').map(Number)
    return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(Date.UTC(yy, mm - 1, dd)))
}

export function DailySpending({ records: initialRecords, plan, today }: Props) {
    const router = useRouter()
    const [records, setRecords] = useState(initialRecords)
    const [rangeKind, setRangeKind] = useState<RangeKind>('mes')
    const [hoverDay, setHoverDay] = useState<string | null>(null)

    const [analysis, setAnalysis] = useState<SpendingAnalysis | null>(plan?.last_spending_analysis || null)
    const [analysisAt, setAnalysisAt] = useState<string | null>(plan?.last_spending_analysis_at || null)
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisError, setAnalysisError] = useState('')

    const [target, setTarget] = useState<number | null>(plan?.daily_spend_target ?? null)
    const [editingTarget, setEditingTarget] = useState(false)
    const [targetDraft, setTargetDraft] = useState(String(plan?.daily_spend_target ?? ''))
    const [targetMsg, setTargetMsg] = useState('')

    // Los registros nuevos llegan por router.refresh() desde el modal rápido.
    const [lastInitial, setLastInitial] = useState(initialRecords)
    if (initialRecords !== lastInitial) {
        setLastInitial(initialRecords)
        setRecords(initialRecords)
    }

    const range = useMemo(() => rangeFor(rangeKind, today), [rangeKind, today])
    const summary = useMemo(() => summarize(records, range.from, range.to), [records, range])
    const prev = useMemo(() => {
        const p = previousRange(range)
        return summarize(records, p.from, p.to)
    }, [records, range])
    const deltas = useMemo(() => new Map(compareCategories(summary, prev).map(d => [d.category, d])), [summary, prev])

    const todaySummary = useMemo(() => summarize(records, today, today), [records, today])
    const todayTotal = todaySummary.dailyTotal

    const hasPrev = prev.count > 0
    const avgDelta = hasPrev && prev.avgPerDay > 0 ? ((summary.avgPerDay - prev.avgPerDay) / prev.avgPerDay) * 100 : null
    const monthProjection = rangeKind === 'mes' ? summary.avgPerDay * daysInMonthOf(today) : null

    const maxBar = Math.max(...summary.series.map(p => p.total), target || 0, 1)
    const maxCat = Math.max(...summary.byCategory.map(c => c.total), 1)
    const maxWeekday = Math.max(...summary.byWeekday.map(w => w.avg), 1)
    const worstWeekday = [...summary.byWeekday].sort((a, b) => b.avg - a.avg)[0]

    const spentNec = summary.byNecessity
    const necTotal = spentNec.necesario + spentNec.gusto + spentNec.impulso + spentNec.sin_dato
    const impulseMonthly = summary.days > 0 ? (spentNec.impulso / summary.days) * 30 : 0

    const rangeItems = useMemo(
        () => records
            .filter(r => r.type !== 'Income' && r.date >= range.from && r.date <= range.to)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
        [records, range]
    )
    const groupedItems = useMemo(() => {
        const groups: { date: string; items: ExpenseRecord[]; total: number }[] = []
        for (const r of rangeItems) {
            const last = groups[groups.length - 1]
            if (last && last.date === r.date) {
                last.items.push(r)
                last.total += r.amount
            } else {
                groups.push({ date: r.date, items: [r], total: r.amount })
            }
        }
        return groups
    }, [rangeItems])
    const [showAllDays, setShowAllDays] = useState(false)

    async function handleAnalyze() {
        setAnalyzing(true)
        setAnalysisError('')
        try {
            const res = await analyzeSpending()
            if (!res.ok) {
                setAnalysisError(res.error)
                return
            }
            setAnalysis(res.data)
            setAnalysisAt(new Date().toISOString())
        } catch (e: any) {
            setAnalysisError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setAnalyzing(false)
        }
    }

    async function saveTarget(value: number | null) {
        setTargetMsg('')
        const res = await saveMoneyPlan({ daily_spend_target: value })
        if (!res.ok) {
            setTargetMsg(res.error)
            return
        }
        setTarget(value)
        setEditingTarget(false)
        setTargetDraft(value ? String(value) : '')
        setTargetMsg(value ? 'Tope guardado.' : 'Tope quitado.')
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este gasto?')) return
        await deleteTransaction(id)
        setRecords(prev => prev.filter(r => r.id !== id))
        router.refresh()
    }

    const noData = records.filter(r => r.type === 'Variable').length === 0

    return (
        <div className="space-y-5">
            {/* Rango + acción */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(Object.keys(RANGE_LABELS) as RangeKind[]).map(k => (
                        <button
                            key={k}
                            onClick={() => setRangeKind(k)}
                            className={cn(
                                'px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all whitespace-nowrap',
                                rangeKind === k
                                    ? 'bg-emerald-600/25 border-emerald-500/50 text-white'
                                    : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                            )}
                        >
                            {RANGE_LABELS[k]}
                        </button>
                    ))}
                </div>
                <QuickExpenseTrigger todayTotal={todayTotal} className="self-start sm:self-auto" />
            </div>

            {noData && (
                <div className="glass rounded-2xl p-5 border border-emerald-500/25 bg-gradient-to-br from-emerald-950/20 to-transparent space-y-2">
                    <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-emerald-400" /> Cómo arrancar
                    </h3>
                    <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed list-disc pl-4">
                        <li>Cada vez que pagás algo, tocá el botón verde <span className="text-emerald-300 font-semibold">🧾</span> (abajo a la derecha, en cualquier pantalla) o <kbd className="px-1 border border-white/20 rounded">Ctrl+Shift+L</kbd>.</li>
                        <li>Monto + categoría alcanza. El detalle, el medio de pago y "¿era necesario?" suman para el análisis.</li>
                        <li>Si se te pasó, cargalo a la noche en el cierre del día con la fecha de "Ayer".</li>
                        <li>Con 2 semanas de registro, el análisis con IA ya te puede decir dónde recortar.</li>
                    </ul>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                    label="Gastaste en el día a día"
                    value={formatCurrency(summary.dailyTotal)}
                    sub={`${RANGE_LABELS[rangeKind].toLowerCase()} · ${summary.count} gastos`}
                />
                <Kpi
                    label="Promedio por día"
                    value={formatCurrency(summary.avgPerDay)}
                    sub={avgDelta === null ? 'sin período anterior para comparar' : `${avgDelta >= 0 ? '▲' : '▼'} ${Math.abs(avgDelta).toFixed(0)}% vs período anterior`}
                    tone={avgDelta === null ? undefined : avgDelta > 5 ? 'bad' : avgDelta < -5 ? 'good' : undefined}
                />
                <Kpi
                    label="Día típico (mediana)"
                    value={formatCurrency(summary.medianDay)}
                    sub={`${summary.noSpendDays} de ${summary.days} días sin gastar`}
                />
                <div className="glass p-4 rounded-2xl border border-border/50">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Hoy / tope diario</p>
                    <p className={cn('text-xl font-bold font-heading', target && todayTotal > target ? 'text-red-400' : 'text-white')}>
                        {formatCurrency(todayTotal)}
                    </p>
                    {editingTarget ? (
                        <form
                            className="flex items-center gap-1 mt-1"
                            onSubmit={(e) => { e.preventDefault(); const v = Number(targetDraft); saveTarget(v > 0 ? Math.round(v) : null) }}
                        >
                            <input
                                autoFocus
                                type="number"
                                inputMode="numeric"
                                value={targetDraft}
                                onChange={(e) => setTargetDraft(e.target.value)}
                                placeholder="Tope"
                                className="w-full min-w-0 bg-black/30 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white font-mono"
                            />
                            <button className="p-1 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                        </form>
                    ) : (
                        <button onClick={() => setEditingTarget(true)} className="text-[10px] text-indigo-300 hover:text-indigo-200 mt-1 font-semibold flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {target ? `Tope ${formatCurrency(target)} · cambiar` : 'Poner un tope diario'}
                        </button>
                    )}
                    {targetMsg && <p className="text-[10px] text-muted-foreground mt-1">{targetMsg}</p>}
                </div>
            </div>

            {monthProjection !== null && summary.dailyTotal > 0 && (
                <p className="text-xs text-muted-foreground -mt-1">
                    Al ritmo de este mes, el día a día cierra en <span className="text-white font-semibold">{formatCurrency(monthProjection)}</span>
                    {summary.fixedTotal > 0 && <> (más {formatCurrency(summary.fixedTotal)} de fijos ya cargados)</>}
                    {target ? <> · con tu tope serían {formatCurrency(target * daysInMonthOf(today))}</> : null}.
                </p>
            )}

            {/* Gasto por día */}
            <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-sm text-white">Gasto por día</h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="w-3 border-t-2 border-dashed border-white/50" /> promedio</span>
                        {target ? <span className="flex items-center gap-1"><span className="w-3 border-t-2 border-amber-400" /> tope</span> : null}
                    </div>
                </div>
                <div className="relative h-40" onMouseLeave={() => setHoverDay(null)}>
                    {/* Líneas de referencia */}
                    {summary.avgPerDay > 0 && (
                        <div
                            className="absolute inset-x-0 border-t-2 border-dashed border-white/30 pointer-events-none z-10"
                            style={{ bottom: `${(summary.avgPerDay / maxBar) * 100}%` }}
                        />
                    )}
                    {target ? (
                        <div
                            className="absolute inset-x-0 border-t-2 border-amber-400/70 pointer-events-none z-10"
                            style={{ bottom: `${Math.min((target / maxBar) * 100, 100)}%` }}
                        />
                    ) : null}
                    <div className="absolute inset-0 flex items-end gap-[2px]">
                        {summary.series.map(p => {
                            const h = (p.total / maxBar) * 100
                            const over = target ? p.total > target : p.total > summary.avgPerDay * 1.8
                            return (
                                <div
                                    key={p.date}
                                    onMouseEnter={() => setHoverDay(p.date)}
                                    onClick={() => setHoverDay(p.date)}
                                    className="flex-1 h-full flex items-end cursor-default"
                                >
                                    <div
                                        className={cn(
                                            'w-full rounded-t-[4px] transition-opacity',
                                            p.date === today ? 'bg-emerald-300' : over ? 'bg-red-400/80' : 'bg-emerald-500/70',
                                            hoverDay && hoverDay !== p.date && 'opacity-40'
                                        )}
                                        style={{ height: `${Math.max(h, p.total > 0 ? 2 : 0)}%` }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{shortDate(range.from)}</span>
                    {hoverDay ? (() => {
                        const p = summary.series.find(s => s.date === hoverDay)
                        return p ? (
                            <span className="text-white font-semibold">
                                {dayLabel(p.date, today)}: {formatCurrency(p.total)} · {p.count} {p.count === 1 ? 'gasto' : 'gastos'}
                            </span>
                        ) : null
                    })() : <span>Pasá el dedo / mouse por una barra</span>}
                    <span>{shortDate(range.to)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Por categoría */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                    <h3 className="font-heading font-bold text-sm text-white">En qué se te va la plata</h3>
                    {summary.byCategory.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-4 text-center">Sin gastos en este período.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {summary.byCategory.slice(0, 10).map(c => {
                                const cat = getCategory(c.category)
                                const d = deltas.get(c.category)
                                return (
                                    <div key={c.category} className="space-y-1" title={`${c.count} gastos · ticket promedio ${formatCurrency(c.avgTicket)}`}>
                                        <div className="flex items-center justify-between text-xs gap-2">
                                            <span className="text-white truncate">{cat.emoji} {c.category}</span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                {hasPrev && summary.days >= 14 && d && d.previous > 0 && Math.abs(d.deltaMonthly) >= 1 && (
                                                    <span className={cn('text-[10px] font-semibold', d.deltaMonthly > 0 ? 'text-red-400' : 'text-emerald-400')}>
                                                        {d.deltaMonthly > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(d.deltaMonthly))}/mes
                                                    </span>
                                                )}
                                                <span className="font-mono font-bold text-white">{formatCurrency(c.total)}</span>
                                                <span className="text-[10px] text-muted-foreground w-8 text-right">{c.pct.toFixed(0)}%</span>
                                            </span>
                                        </div>
                                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-indigo-500/80" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Necesario / gusto / impulso + medios de pago */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-heading font-bold text-sm text-white">¿Era necesario?</h3>
                        {necTotal > 0 ? (
                            <>
                                <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-black/30">
                                    {NECESSITY_LEVELS.map(l => {
                                        const v = spentNec[l.id]
                                        return v > 0 ? (
                                            <div key={l.id} title={`${l.label}: ${formatCurrency(v)}`} style={{ width: `${(v / necTotal) * 100}%`, backgroundColor: l.color }} />
                                        ) : null
                                    })}
                                    {spentNec.sin_dato > 0 && <div title={`Sin marcar: ${formatCurrency(spentNec.sin_dato)}`} className="bg-white/15" style={{ width: `${(spentNec.sin_dato / necTotal) * 100}%` }} />}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                    {NECESSITY_LEVELS.map(l => (
                                        <div key={l.id} className="flex items-center justify-between gap-2">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />{l.label}
                                            </span>
                                            <span className="font-mono text-white">{formatCurrency(spentNec[l.id])}</span>
                                        </div>
                                    ))}
                                    {spentNec.sin_dato > 0 && (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/30" />Sin marcar</span>
                                            <span className="font-mono text-white">{formatCurrency(spentNec.sin_dato)}</span>
                                        </div>
                                    )}
                                </div>
                                {impulseMonthly > 0 && (
                                    <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex gap-1.5">
                                        <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                                        Los impulsos te cuestan ~{formatCurrency(impulseMonthly)} por mes ({formatCurrency(impulseMonthly * 12)} al año).
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Sin datos todavía.</p>
                        )}
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                        <h3 className="font-heading font-bold text-sm text-white">Cómo pagás</h3>
                        {summary.byMethod.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Sin datos todavía.</p>
                        ) : summary.byMethod.map(m => {
                            const pm = getPaymentMethod(m.method)
                            return (
                                <div key={m.method} className="flex items-center justify-between text-[11px] gap-2">
                                    <span className="text-muted-foreground">{pm ? `${pm.emoji} ${pm.label}` : 'Sin dato'}</span>
                                    <span className="flex items-center gap-2">
                                        <span className="font-mono text-white">{formatCurrency(m.total)}</span>
                                        <span className="text-muted-foreground w-8 text-right">{m.pct.toFixed(0)}%</span>
                                    </span>
                                </div>
                            )
                        })}
                        {(summary.byMethod.find(m => m.method === 'credito')?.pct || 0) > 30 && (
                            <p className="text-[11px] text-red-300/90">Más del 30% va con tarjeta de crédito: es plata que todavía no tenés. Ojo con el resumen.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Hormiga */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                    <div>
                        <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2"><Bug className="w-4 h-4 text-amber-400" /> Gastos hormiga</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Chiquitos y repetidos (3 o más veces, ticket ≤ {formatCurrency(Math.max(summary.typicalTicket * 1.5, 0))}).</p>
                    </div>
                    {summary.hormiga.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No aparecen todavía. Se detectan con al menos 3 repeticiones.</p>
                    ) : (
                        <div className="space-y-2">
                            {summary.hormiga.map(h => (
                                <div key={`${h.label}-${h.category}`} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs">
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold truncate">{getCategory(h.category).emoji} {h.label}</p>
                                        <p className="text-[10px] text-muted-foreground">{h.count} veces · {formatCurrency(h.avgTicket)} promedio</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-mono font-bold text-amber-300">{formatCurrency(h.monthly)}/mes</p>
                                        <p className="text-[10px] text-muted-foreground">{formatCurrency(h.yearly)}/año</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Día de la semana */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                    <div>
                        <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400" /> Qué día gastás más</h3>
                        {worstWeekday && worstWeekday.avg > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Los {WEEKDAY_FULL[worstWeekday.weekday]} gastás en promedio {formatCurrency(worstWeekday.avg)}
                                {summary.avgPerDay > 0 && <> ({(worstWeekday.avg / summary.avgPerDay).toFixed(1)}× tu promedio)</>}.
                            </p>
                        )}
                    </div>
                    <div className="flex items-end gap-2 h-28">
                        {summary.byWeekday.map(w => (
                            <div key={w.weekday} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${w.label}: ${formatCurrency(w.avg)} promedio`}>
                                <div
                                    className={cn('w-full rounded-t-[4px]', w.weekday === worstWeekday?.weekday && w.avg > 0 ? 'bg-indigo-400' : 'bg-indigo-500/50')}
                                    style={{ height: `${Math.max((w.avg / maxWeekday) * 100, w.avg > 0 ? 3 : 0)}%` }}
                                />
                                <span className="text-[10px] text-muted-foreground">{w.label}</span>
                            </div>
                        ))}
                    </div>
                    {summary.expensiveDays.length > 0 && (
                        <div className="border-t border-white/5 pt-2 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Días caros</p>
                            {summary.expensiveDays.map(d => (
                                <p key={d.date} className="text-[11px] text-muted-foreground">
                                    <span className="text-white capitalize">{dayLabel(d.date, today)}</span>: {formatCurrency(d.total)}{d.topItem ? ` · sobre todo ${d.topItem}` : ''}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Analista IA */}
            <div className="glass rounded-3xl p-5 border border-violet-500/25 bg-gradient-to-br from-violet-950/20 to-transparent space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-400" /> Dónde recortar
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            La IA mira tus últimos 30 días, los compara con los 30 anteriores y te dice qué cambiar.
                            {analysisAt && <> Último análisis: {new Date(analysisAt).toLocaleDateString('es-AR')}.</>}
                        </p>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/20 disabled:opacity-60 self-start"
                    >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {analysis ? 'Volver a analizar' : 'Analizar mis gastos'}
                    </button>
                </div>

                {analysisError && (
                    <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {analysisError}
                    </p>
                )}

                {analysis && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-white">{analysis.headline}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{analysis.diagnosis}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ahorro posible</p>
                                <p className="text-xl font-bold text-white font-heading">{formatCurrency(analysis.total_potential_saving)}<span className="text-xs text-muted-foreground font-normal">/mes</span></p>
                                <p className="text-[10px] text-muted-foreground">{formatCurrency(analysis.total_potential_saving * 12)} al año</p>
                            </div>
                            {analysis.daily_target > 0 && (
                                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Tope diario sugerido</p>
                                    <p className="text-xl font-bold text-white font-heading">{formatCurrency(analysis.daily_target)}</p>
                                    {target === analysis.daily_target ? (
                                        <p className="text-[10px] text-emerald-300 font-semibold">✓ Es tu tope actual</p>
                                    ) : (
                                        <button onClick={() => saveTarget(analysis.daily_target)} className="text-[10px] text-amber-200 hover:text-white font-semibold">
                                            Usarlo como mi tope →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {analysis.quick_win && (
                            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-2">
                                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Esta semana</p>
                                    <p className="text-xs text-white">{analysis.quick_win}</p>
                                </div>
                            </div>
                        )}

                        {analysis.leaks.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fugas</p>
                                {analysis.leaks.map((l, i) => (
                                    <div key={i} className="p-3 rounded-2xl bg-black/20 border border-white/5 space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-bold text-white">{getCategory(l.category).emoji} {l.title}</p>
                                            <span className="text-[10px] font-mono text-red-300 shrink-0">{formatCurrency(l.monthly_amount)}/mes</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{l.why}</p>
                                        <p className="text-[11px] text-white flex gap-1"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400" />{l.action}</p>
                                        {l.monthly_saving > 0 && <p className="text-[10px] text-emerald-300 font-semibold">Ahorro: ~{formatCurrency(l.monthly_saving)}/mes</p>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {analysis.swaps.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reemplazos</p>
                                {analysis.swaps.map((s, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 p-2.5 rounded-xl bg-black/20 border border-white/5 text-[11px]">
                                        <span className="text-red-300/90 line-through decoration-red-400/50 sm:flex-1">{s.from}</span>
                                        <Repeat className="w-3 h-3 text-muted-foreground hidden sm:block shrink-0" />
                                        <span className="text-white sm:flex-1">{s.to}</span>
                                        <span className="text-emerald-300 font-mono shrink-0">+{formatCurrency(s.monthly_saving)}/mes</span>
                                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">esfuerzo {s.effort}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {analysis.rules.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tus reglas</p>
                                {analysis.rules.map((r, i) => (
                                    <p key={i} className="text-xs text-white flex gap-1.5"><Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />{r}</p>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Lista de gastos por día */}
            <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-sm text-white">Registro ({rangeItems.length})</h3>
                    <span className="text-[10px] text-muted-foreground">{RANGE_LABELS[rangeKind]}</span>
                </div>
                {groupedItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Sin gastos en este período.</p>
                ) : (
                    <div className="space-y-3">
                        {(showAllDays ? groupedItems : groupedItems.slice(0, 7)).map(g => (
                            <div key={g.date} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] px-1">
                                    <span className="font-semibold text-white capitalize">{dayLabel(g.date, today)}</span>
                                    <span className={cn('font-mono font-bold', target && g.total > target ? 'text-red-400' : 'text-muted-foreground')}>
                                        {formatCurrency(g.total)}
                                    </span>
                                </div>
                                {g.items.map(r => {
                                    const cat = getCategory(r.category)
                                    const pm = getPaymentMethod(r.payment_method)
                                    const nec = NECESSITY_LEVELS.find(l => l.id === r.necessity)
                                    return (
                                        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/20 border border-border/40 text-xs">
                                            <div className="min-w-0 flex items-center gap-2">
                                                <span className="text-base shrink-0">{cat.emoji}</span>
                                                <div className="min-w-0">
                                                    <p className="text-white truncate">{r.description || r.category}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {r.category}
                                                        {pm && ` · ${pm.label}`}
                                                        {nec && ` · ${nec.emoji} ${nec.label}`}
                                                        {r.type === 'Fixed_Expense' && ' · fijo'}
                                                        {r.type === 'Debt_Payment' && ' · deuda'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-mono font-bold text-red-300">-{formatCurrency(r.amount)}</span>
                                                <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-red-400 p-1" title="Eliminar">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                        {groupedItems.length > 7 && (
                            <button onClick={() => setShowAllDays(v => !v)} className="w-full text-[11px] text-indigo-300 hover:text-indigo-200 font-semibold py-1">
                                {showAllDays ? 'Ver menos' : `Ver los ${groupedItems.length} días`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'bad' }) {
    return (
        <div className="glass p-4 rounded-2xl border border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold font-heading text-white">{value}</p>
            <p className={cn(
                'text-[10px] mt-0.5 flex items-center gap-1',
                tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : 'text-muted-foreground'
            )}>
                {tone === 'bad' && <TrendingUp className="w-3 h-3" />}
                {tone === 'good' && <TrendingDown className="w-3 h-3" />}
                {sub}
            </p>
        </div>
    )
}
