'use client'

import { useState } from 'react'
import {
    Sparkles, Loader2, AlertTriangle, ArrowRight, Wallet, Check,
    TrendingDown, HandCoins, Info
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    getDebtStrategy, allocateIncome, applyAllocation, saveIncomeAllocation,
    type DebtStrategy as Strategy, type AllocationPlan, type DebtsOverview
} from '@/lib/actions/debts'
import { formatCurrency, cn } from '@/lib/utils'
import type { PayoffMethod } from '@/lib/debtMath'

interface Props {
    overview: DebtsOverview
    incomeRange: { floor: number; ceiling: number; sources: number }
    upcoming: { date: string; name: string; amount: number; confidence: string; kind: string }[]
    monthlyExpenses: number
    allocations: any[]
}

const TARGET_STYLE: Record<string, string> = {
    debt: 'text-red-300 bg-red-500/10 border-red-500/25',
    expense: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25',
    buffer: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
    goal: 'text-purple-300 bg-purple-500/10 border-purple-500/25'
}

const TARGET_LABEL: Record<string, string> = {
    debt: 'Deuda',
    expense: 'Gasto',
    buffer: 'Colchón',
    goal: 'Meta'
}

export function DebtStrategyPanel({ overview, incomeRange, upcoming, monthlyExpenses, allocations }: Props) {
    const router = useRouter()

    const [method, setMethod] = useState<PayoffMethod | ''>('')
    const [strategy, setStrategy] = useState<Strategy | null>(null)
    const [loadingStrategy, setLoadingStrategy] = useState(false)
    const [strategyError, setStrategyError] = useState('')

    const [amount, setAmount] = useState('')
    const [label, setLabel] = useState('')
    const [plan, setPlan] = useState<AllocationPlan | null>(null)
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [planError, setPlanError] = useState('')
    const [applying, setApplying] = useState(false)

    // El hueco estructural: lo que entra seguro menos lo que se va sí o sí.
    const committed = monthlyExpenses + overview.totals.monthlyInstallments
    const gap = incomeRange.floor - committed

    async function handleStrategy() {
        setLoadingStrategy(true)
        setStrategyError('')
        try {
            const res = await getDebtStrategy(method || undefined)
            if (!res.ok) {
                setStrategyError(res.error)
                return
            }
            setStrategy(res.data)
        } catch (e: any) {
            setStrategyError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setLoadingStrategy(false)
        }
    }

    async function handleAllocate() {
        const value = Number(amount)
        if (!(value > 0)) return
        setLoadingPlan(true)
        setPlanError('')
        try {
            const res = await allocateIncome(value, label || undefined)
            if (!res.ok) {
                setPlanError(res.error)
                return
            }
            setPlan(res.data)
        } catch (e: any) {
            setPlanError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setLoadingPlan(false)
        }
    }

    async function handleApply() {
        if (!plan) return
        if (!confirm('Esto registra los pagos a deudas que propone el plan y descuenta los saldos. ¿Seguimos?')) return
        setApplying(true)
        const res = await applyAllocation(plan, label || undefined)
        setApplying(false)
        if ('error' in res && res.error) return alert(res.error)
        if (res.failures?.length) alert(`Algunos pagos fallaron: ${res.failures.join(' · ')}`)
        setPlan(null)
        setAmount('')
        setLabel('')
        router.refresh()
    }

    async function handleJustSave() {
        if (!plan) return
        await saveIncomeAllocation(plan, label || undefined)
        setPlan(null)
        router.refresh()
    }

    return (
        <div className="space-y-5">
            {/* Diagnóstico sin IA: los números crudos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={cn(
                    'glass p-5 rounded-2xl border lg:col-span-2',
                    gap < 0 ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/25'
                )}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        El hueco del mes
                    </p>
                    {incomeRange.sources === 0 ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Todavía no cargaste tus fuentes de ingreso. Sin eso, cualquier plan es a ciegas:
                            cargalas en la pestaña <strong className="text-foreground">Ingresos</strong> y volvé.
                        </p>
                    ) : (
                        <>
                            <h3 className={cn('text-2xl font-bold font-heading', gap < 0 ? 'text-red-400' : 'text-emerald-400')}>
                                {gap < 0 ? `Te faltan ${formatCurrency(Math.abs(gap))}` : `Te sobran ${formatCurrency(gap)}`}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                                Entra seguro <strong className="text-foreground">{formatCurrency(incomeRange.floor)}</strong> por mes
                                {incomeRange.ceiling > incomeRange.floor && (
                                    <> (hasta {formatCurrency(incomeRange.ceiling)} si sale todo)</>
                                )}
                                {' '}y sale sí o sí <strong className="text-foreground">{formatCurrency(committed)}</strong>{' '}
                                ({formatCurrency(monthlyExpenses)} de gastos + {formatCurrency(overview.totals.monthlyInstallments)} de cuotas).
                            </p>
                            {gap < 0 && (
                                <p className="text-[11px] text-red-300/90 mt-2 leading-relaxed">
                                    Ese hueco lo tapan los ingresos variables. Mientras dependa de que salga un cliente,
                                    lo primero no es elegir qué deuda pagar: es no comprometer plata que todavía no entró.
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className="glass p-5 rounded-2xl border border-orange-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Costo de no hacer nada
                    </p>
                    <h3 className="text-2xl font-bold font-heading text-orange-400">
                        {formatCurrency(overview.totals.monthlyCost)}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        por mes solo en intereses ({formatCurrency(overview.totals.dailyCost)} por día)
                    </p>
                </div>
            </div>

            {/* Próximos cobros */}
            {upcoming.length > 0 && (
                <div className="glass p-4 rounded-2xl border border-border/50 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <HandCoins className="w-3.5 h-3.5 text-emerald-400" /> Próximos cobros estimados
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {upcoming.slice(0, 8).map((u, i) => (
                            <span
                                key={i}
                                className={cn(
                                    'text-[10px] px-2.5 py-1 rounded-lg border',
                                    u.confidence === 'confirmada'
                                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                        : u.confidence === 'probable'
                                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                                            : 'bg-secondary/60 border-border text-muted-foreground'
                                )}
                            >
                                {u.date.split('-').reverse().slice(0, 2).join('/')} · {u.name} · {formatCurrency(u.amount)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Asesor: qué pagar primero */}
            <div className="glass p-5 rounded-2xl border border-violet-500/25 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-heading font-bold text-white">¿Qué deuda pago primero?</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Mira tus tasas reales, tus ingresos y tus cuotas, y arma el orden.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <select
                            value={method}
                            onChange={e => setMethod(e.target.value as PayoffMethod | '')}
                            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                            <option value="">Que elija el asesor</option>
                            <option value="avalancha">Avalancha (menos interés)</option>
                            <option value="bola_de_nieve">Bola de nieve (victorias rápidas)</option>
                        </select>
                        <button
                            onClick={handleStrategy}
                            disabled={loadingStrategy}
                            className="px-4 py-2.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                        >
                            {loadingStrategy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Armar el plan
                        </button>
                    </div>
                </div>

                {strategyError && (
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 leading-relaxed break-words">
                        {strategyError}
                    </p>
                )}

                {strategy && (
                    <div className="space-y-3 pt-1">
                        {strategy.headline && (
                            <p className="text-sm font-bold text-white leading-snug">{strategy.headline}</p>
                        )}
                        {strategy.diagnosis && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{strategy.diagnosis}</p>
                        )}

                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-200 font-semibold">
                                Método: {strategy.recommended_method === 'avalancha' ? 'Avalancha' : 'Bola de nieve'}
                            </span>
                            <span className="text-muted-foreground">{strategy.method_reason}</span>
                        </div>

                        {strategy.order.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Orden de ataque
                                </span>
                                {strategy.order.map(o => (
                                    <div key={o.debt_id} className="flex items-start gap-2.5 bg-secondary/40 border border-border/50 rounded-xl p-3">
                                        <span className="w-6 h-6 rounded-lg bg-violet-600/25 border border-violet-500/30 text-violet-200 text-[11px] font-bold flex items-center justify-center shrink-0">
                                            {o.position}
                                        </span>
                                        <div className="min-w-0 space-y-0.5">
                                            <p className="text-[12px] font-bold text-white">{o.creditor}</p>
                                            <p className="text-[11px] text-indigo-300">{o.action}</p>
                                            {o.why && <p className="text-[11px] text-muted-foreground">{o.why}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {strategy.refinance.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    ¿Cuál financiar en cuotas?
                                </span>
                                {strategy.refinance.map(r => (
                                    <div
                                        key={r.debt_id}
                                        className={cn(
                                            'flex items-start gap-2 rounded-xl p-2.5 border text-[11px]',
                                            r.verdict === 'financiar'
                                                ? 'bg-sky-500/10 border-sky-500/25'
                                                : 'bg-secondary/40 border-border/50'
                                        )}
                                    >
                                        <span className={cn(
                                            'text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5',
                                            r.verdict === 'financiar'
                                                ? 'bg-sky-500/20 text-sky-200'
                                                : 'bg-secondary text-muted-foreground'
                                        )}>
                                            {r.verdict === 'financiar' ? 'FINANCIAR' : 'NO'}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white">{r.creditor}</p>
                                            <p className="text-muted-foreground">{r.why}</p>
                                        </div>
                                    </div>
                                ))}
                                <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                    Cuando arregles uno de verdad, cargalo en la pestaña Deudas con
                                    "Arreglé un plan de pago": ahí se simula y se convierte en cuota fija.
                                </p>
                            </div>
                        )}

                        {strategy.warnings.length > 0 && (
                            <div className="space-y-1.5">
                                {strategy.warnings.map((w, i) => (
                                    <p key={i} className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <span>{w}</span>
                                    </p>
                                ))}
                            </div>
                        )}

                        {strategy.next_step && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                                    <ArrowRight className="w-3 h-3" /> Hoy, esto
                                </p>
                                <p className="text-[12px] text-white">{strategy.next_step}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Asignación de un ingreso */}
            <div className="glass p-5 rounded-2xl border border-emerald-500/25 space-y-3">
                <div>
                    <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400" /> Me entró plata, ¿a qué la destino?
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Reparte el monto entre cuotas, gastos por vencer, deudas que sangran y colchón.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="number"
                        step="1000"
                        min="0"
                        value={amount}
                        onChange={e => { setAmount(e.target.value); setPlan(null) }}
                        placeholder="Cuánto entró"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="De dónde (ej: seña del cliente X)"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                        onClick={handleAllocate}
                        disabled={loadingPlan || !amount}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                    >
                        {loadingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                        Repartir
                    </button>
                </div>

                {planError && (
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 leading-relaxed break-words">
                        {planError}
                    </p>
                )}

                {plan && (
                    <div className="space-y-2.5 pt-1">
                        {plan.rationale && (
                            <p className="text-[11px] text-emerald-200/90 leading-relaxed">{plan.rationale}</p>
                        )}

                        <div className="space-y-1.5">
                            {plan.items.map((item, i) => (
                                <div key={i} className="flex items-start justify-between gap-3 bg-secondary/40 border border-border/50 rounded-xl p-3">
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-semibold', TARGET_STYLE[item.target_type])}>
                                                {TARGET_LABEL[item.target_type]}
                                            </span>
                                            <span className="text-[12px] font-bold text-white">{item.label}</span>
                                        </div>
                                        {item.reason && <p className="text-[11px] text-muted-foreground">{item.reason}</p>}
                                    </div>
                                    <span className="font-mono font-bold text-emerald-400 text-sm shrink-0">
                                        {formatCurrency(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {plan.leftover > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                                Queda sin asignar: <strong className="text-foreground font-mono">{formatCurrency(plan.leftover)}</strong>
                            </p>
                        )}

                        {plan.warning && (
                            <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>{plan.warning}</span>
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                                onClick={handleApply}
                                disabled={applying}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Aplicar: registrar los pagos a deudas
                            </button>
                            <button
                                onClick={handleJustSave}
                                className="flex-1 py-2.5 bg-secondary hover:bg-secondary/70 border border-border text-foreground rounded-xl text-xs font-semibold"
                            >
                                Solo guardar el plan
                            </button>
                        </div>
                    </div>
                )}

                {allocations.length > 0 && !plan && (
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Repartos anteriores
                        </span>
                        {allocations.slice(0, 4).map((a: any) => (
                            <div key={a.id} className="text-[11px] text-muted-foreground flex items-center justify-between">
                                <span>
                                    {a.date.split('-').reverse().slice(0, 2).join('/')} · {a.source_label || 'Sin etiqueta'}
                                </span>
                                <span className="font-mono text-foreground">{formatCurrency(Number(a.amount))}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
