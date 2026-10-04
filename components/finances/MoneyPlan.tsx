'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Sparkles, Loader2, AlertTriangle, Save, RotateCcw, Compass, ShieldCheck,
    TrendingUp, Landmark, ListChecks, Info, ArrowRight, Check, Lightbulb
} from 'lucide-react'
import {
    BUCKETS, PHASE_INFO, INVESTMENT_OPTIONS, EXPENSIVE_DEBT_MONTHLY_PCT,
    futureValue, passiveIncome, type BucketId, type BucketPlan
} from '@/lib/moneyPlan'
import {
    saveMoneyPlan, getInvestmentAdvice,
    type MoneyPlanRow, type PlanContext, type InvestmentAdvice
} from '@/lib/actions/expenses'
import type { ExpenseRecord } from '@/lib/spendingMath'
import { shiftDate } from '@/lib/spendingMath'
import { getCategory } from '@/lib/expenseCategories'
import { formatCurrency as formatARS, cn } from '@/lib/utils'

/** Sin centavos: en promedios y proyecciones solo meten ruido. */
const formatCurrency = (x: number) => formatARS(Math.round(x))

interface Props {
    plan: MoneyPlanRow | null
    context: PlanContext | null
    records: ExpenseRecord[]
    today: string
}

type Risk = 'conservador' | 'moderado' | 'agresivo'

const RISK_INFO: Record<Risk, string> = {
    conservador: 'No querés ver tu plata bajar. Priorizás no perder.',
    moderado: 'Aceptás que baje un poco algún año si a largo plazo rinde más.',
    agresivo: 'Plata que no vas a tocar en 5+ años; bancás caídas fuertes.'
}

const SCENARIOS = [
    { label: 'Prudente', pct: 3 },
    { label: 'Medio', pct: 5 },
    { label: 'Optimista', pct: 7 }
]

/** Dónde conviene poner cada destino según cuánto es por mes y el perfil. */
function destinationFor(bucket: BucketId, monthly: number, risk: Risk): string {
    if (bucket === 'colchon') return 'Cuenta remunerada o FCI Money Market (liquidez inmediata)'
    if (bucket === 'inversion') {
        if (monthly <= 0) return '—'
        if (risk === 'conservador') return monthly < 50000
            ? 'FCI Money Market hasta juntar un monto, después plazo fijo UVA / bonos CER'
            : 'Mitad bonos CER o plazo fijo UVA, mitad dólar MEP → ONs'
        if (risk === 'moderado') return monthly < 50000
            ? 'Acumulá en Money Market y una vez por mes comprá ONs en dólares'
            : '60% ONs en dólares + 40% CEDEARs de ETF (S&P 500)'
        return monthly < 50000
            ? 'Una compra mensual de CEDEAR de ETF (S&P 500), siempre el mismo monto'
            : '70% CEDEARs de ETFs + 30% ONs en dólares'
    }
    if (bucket === 'deudas') return 'Cuotas al día + todo el extra a la deuda más cara'
    if (bucket === 'necesidades') return 'Cuenta sueldo / débito automático de fijos'
    return 'Billetera aparte, con tope: cuando se acaba, se acaba'
}

export function MoneyPlan({ plan, context, records, today }: Props) {
    const router = useRouter()
    const rec = context?.recommendation

    const [income, setIncome] = useState<string>(String(Math.round(plan?.monthly_income ?? context?.inputs.monthlyIncome ?? 0) || ''))
    const [risk, setRisk] = useState<Risk>(plan?.risk_profile || 'conservador')
    const [emergency, setEmergency] = useState(String(plan?.emergency_fund_current || ''))
    const [invested, setInvested] = useState(String(plan?.invested_current || ''))
    const [buckets, setBuckets] = useState<BucketPlan>(plan?.buckets || rec?.buckets || BUCKETS.map(b => ({ id: b.id, pct: 20 })))

    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

    const [advice, setAdvice] = useState<InvestmentAdvice | null>(plan?.last_investment_advice || null)
    const [adviceAt, setAdviceAt] = useState<string | null>(plan?.last_investment_advice_at || null)
    const [advising, setAdvising] = useState(false)
    const [adviceError, setAdviceError] = useState('')

    const [catalogFilter, setCatalogFilter] = useState<'todos' | 'colchon' | 'inversion'>('todos')

    const incomeValue = Number(income) || 0
    const total = buckets.reduce((s, b) => s + b.pct, 0)
    const amountOf = (id: BucketId) => Math.round((incomeValue * (buckets.find(b => b.id === id)?.pct || 0)) / 100)
    const investMonthly = amountOf('inversion')
    const usingRecommended = !!rec && rec.buckets.every(r => buckets.find(b => b.id === r.id)?.pct === r.pct)

    // Lo que realmente salió en los últimos 30 días, para contrastar con el plan.
    const actual = useMemo(() => {
        const from = shiftDate(today, -29)
        const last30 = records.filter(r => r.date >= from && r.date <= today)
        const spend = last30.filter(r => r.type === 'Variable' || r.type === 'Fixed_Expense')
        const isNeed = (r: ExpenseRecord) => r.necessity
            ? r.necessity === 'necesario'
            : r.type === 'Fixed_Expense' || r.is_recurring || getCategory(r.category).group === 'esencial'
        return {
            necesidades: spend.filter(isNeed).reduce((s, r) => s + r.amount, 0),
            gustos: spend.filter(r => !isNeed(r)).reduce((s, r) => s + r.amount, 0),
            deudas: last30.filter(r => r.type === 'Debt_Payment').reduce((s, r) => s + r.amount, 0)
        } as Partial<Record<BucketId, number>>
    }, [records, today])

    const maxRate = context?.inputs.maxDebtMonthlyRatePct || 0
    const hasDebt = (context?.inputs.debtRemaining || 0) > 0

    function setPct(id: BucketId, pct: number) {
        setBuckets(prev => prev.map(b => (b.id === id ? { ...b, pct: Math.max(0, Math.min(100, Math.round(pct))) } : b)))
    }

    async function handleSave() {
        setSaving(true)
        setMessage(null)
        try {
            const res = await saveMoneyPlan({
                monthly_income: incomeValue > 0 ? incomeValue : null,
                buckets,
                risk_profile: risk,
                emergency_fund_current: Number(emergency) || 0,
                invested_current: Number(invested) || 0
            })
            if (!res.ok) {
                setMessage({ ok: false, text: res.error })
                return
            }
            setMessage({ ok: true, text: 'Plan guardado.' })
            router.refresh()
        } finally {
            setSaving(false)
        }
    }

    async function handleAdvice() {
        setAdvising(true)
        setAdviceError('')
        try {
            // El asesor lee lo guardado: primero se guarda lo que está en pantalla.
            if (total === 100) {
                const saved = await saveMoneyPlan({
                    monthly_income: incomeValue > 0 ? incomeValue : null,
                    buckets,
                    risk_profile: risk,
                    emergency_fund_current: Number(emergency) || 0,
                    invested_current: Number(invested) || 0
                })
                if (!saved.ok) {
                    setAdviceError(saved.error)
                    return
                }
            }
            const res = await getInvestmentAdvice()
            if (!res.ok) {
                setAdviceError(res.error)
                return
            }
            setAdvice(res.data)
            setAdviceAt(new Date().toISOString())
        } catch (e: any) {
            setAdviceError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setAdvising(false)
        }
    }

    const phase = rec ? PHASE_INFO[rec.phase] : null

    return (
        <div className="space-y-5">
            {/* Datos base */}
            <div className="glass rounded-3xl p-5 border border-border/50 space-y-4">
                <div>
                    <h3 className="font-heading font-bold text-base text-white">Tu punto de partida</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {context?.incomeSource === 'fuentes' && !plan?.monthly_income
                            ? 'El ingreso viene de tus fuentes confirmadas (pestaña Ingresos). Cambialo si querés planificar con otro número.'
                            : 'Con cuánto planificás el mes. Usá lo que entra seguro, no lo que "debería" entrar.'}
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MoneyField label="Ingreso mensual" value={income} onChange={setIncome} />
                    <MoneyField label="Ya tenés de colchón" value={emergency} onChange={setEmergency} hint={rec ? `meta ~${formatCurrency(rec.emergencyTarget)}` : undefined} />
                    <MoneyField label="Ya tenés invertido" value={invested} onChange={setInvested} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Perfil de riesgo</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(Object.keys(RISK_INFO) as Risk[]).map(r => (
                            <button
                                key={r}
                                onClick={() => setRisk(r)}
                                className={cn(
                                    'text-left p-2.5 rounded-xl border transition-all',
                                    risk === r ? 'bg-indigo-600/20 border-indigo-400' : 'bg-black/20 border-white/10 hover:bg-white/5'
                                )}
                            >
                                <p className="text-xs font-bold text-white capitalize">{r}</p>
                                <p className="text-[10px] text-muted-foreground leading-snug">{RISK_INFO[r]}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Etapa */}
            {rec && phase && (
                <div className="glass rounded-3xl p-5 border border-amber-500/25 bg-gradient-to-br from-amber-950/15 to-transparent space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0"><Compass className="w-4 h-4" /></div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tu etapa hoy</p>
                            <h3 className="font-heading font-bold text-white">{phase.label}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{phase.summary}</p>
                        </div>
                    </div>
                    <ul className="space-y-1">
                        {rec.reasons.map((r, i) => (
                            <li key={i} className="text-[11px] text-white/85 flex gap-1.5"><ArrowRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />{r}</li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground pt-1">
                        {(['supervivencia', 'deuda_cara', 'deuda_barata', 'colchon', 'crecer'] as const).map((p, i) => (
                            <span key={p} className={cn('px-2 py-0.5 rounded-lg border', p === rec.phase ? 'border-amber-400 text-amber-200 bg-amber-500/10' : 'border-white/10')}>
                                {i + 1}. {PHASE_INFO[p].label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Reparto */}
            <div className="glass rounded-3xl p-5 border border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-heading font-bold text-base text-white">Cómo repartir cada sueldo</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Movelo a tu gusto. Tiene que sumar 100%.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {rec && !usingRecommended && (
                            <button onClick={() => setBuckets(rec.buckets)} className="px-3 py-2 rounded-xl text-[11px] font-semibold border border-white/10 text-muted-foreground hover:text-white flex items-center gap-1">
                                <RotateCcw className="w-3.5 h-3.5" /> Usar recomendado
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || total !== 100}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar plan
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex h-4 rounded-full overflow-hidden gap-[2px] bg-black/30">
                        {buckets.map(b => {
                            const def = BUCKETS.find(x => x.id === b.id)!
                            return b.pct > 0 ? <div key={b.id} title={`${def.label}: ${b.pct}%`} style={{ width: `${(b.pct / Math.max(total, 100)) * 100}%`, backgroundColor: def.color }} /> : null
                        })}
                    </div>
                    <p className={cn('text-[11px] font-semibold', total === 100 ? 'text-emerald-400' : 'text-red-400')}>
                        Suma: {total}% {total !== 100 && `(${total > 100 ? 'sobran' : 'faltan'} ${Math.abs(100 - total)}%)`}
                    </p>
                </div>

                <div className="space-y-3">
                    {buckets.map(b => {
                        const def = BUCKETS.find(x => x.id === b.id)!
                        const amount = amountOf(b.id)
                        const real = actual[b.id]
                        const recPct = rec?.buckets.find(r => r.id === b.id)?.pct
                        return (
                            <div key={b.id} className="p-3 rounded-2xl bg-black/20 border border-white/5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
                                            {def.emoji} {def.label}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">{def.description}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold font-mono text-white">{formatCurrency(amount)}</p>
                                        <p className="text-[10px] text-muted-foreground">por mes</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={0}
                                        max={90}
                                        value={b.pct}
                                        onChange={(e) => setPct(b.id, Number(e.target.value))}
                                        className="flex-1 accent-indigo-500"
                                        aria-label={`Porcentaje para ${def.label}`}
                                    />
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={b.pct}
                                            onChange={(e) => setPct(b.id, Number(e.target.value))}
                                            className="w-12 bg-black/30 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white font-mono text-right"
                                        />
                                        <span className="text-xs text-muted-foreground">%</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                                    {recPct !== undefined && recPct !== b.pct && <span>Recomendado: {recPct}%</span>}
                                    {real !== undefined && real > 0 && (
                                        <span className={cn(incomeValue > 0 && real > amount * 1.05 ? 'text-red-300' : '')}>
                                            Real últimos 30 días: {formatCurrency(real)}
                                            {incomeValue > 0 && real > amount * 1.05 && ` (te pasás ${formatCurrency(real - amount)})`}
                                        </span>
                                    )}
                                    <span className="text-white/60">→ {destinationFor(b.id, amount, risk)}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {message && (
                    <p className={cn('text-xs rounded-xl px-3 py-2 border', message.ok ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-300 bg-red-500/10 border-red-500/20')}>
                        {message.text}
                    </p>
                )}
            </div>

            {/* Pagate primero */}
            {incomeValue > 0 && (
                <div className="glass rounded-3xl p-5 border border-emerald-500/25 space-y-3">
                    <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-emerald-400" /> El día que cobrás: pagate primero
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                        Lo que se separa apenas entra la plata, se respeta. Lo que "sobra a fin de mes", nunca sobra.
                    </p>
                    <ol className="space-y-2">
                        {[
                            hasDebt && amountOf('deudas') > 0 && { text: `Pagá cuotas y mandá ${formatCurrency(amountOf('deudas'))} a deudas`, sub: 'Primero lo que vence, el extra a la deuda que más interés cobra (pestaña Estrategia).' },
                            amountOf('colchon') > 0 && { text: `Transferí ${formatCurrency(amountOf('colchon'))} al colchón`, sub: 'Una cuenta remunerada o money market separada de la del día a día. No es para gastar.' },
                            investMonthly > 0 && { text: `Invertí ${formatCurrency(investMonthly)}`, sub: destinationFor('inversion', investMonthly, risk) },
                            amountOf('gustos') > 0 && { text: `Separá ${formatCurrency(amountOf('gustos'))} para gustos`, sub: `Son ~${formatCurrency(amountOf('gustos') / 30)} por día. Si se terminan, se terminan.` },
                            { text: `El resto (${formatCurrency(amountOf('necesidades'))}) es para vivir`, sub: `Tu presupuesto de necesidades: ~${formatCurrency(amountOf('necesidades') / 30)} por día.` }
                        ].filter(Boolean).map((step: any, i) => (
                            <li key={i} className="flex gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                <div>
                                    <p className="text-xs font-semibold text-white">{step.text}</p>
                                    <p className="text-[10px] text-muted-foreground">{step.sub}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Deuda vs inversión */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                    <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-red-400" /> ¿Pagar deuda o invertir?</h3>
                    {hasDebt ? (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <p className="text-[10px] text-muted-foreground">Tu deuda más cara</p>
                                    <p className="text-lg font-bold text-red-300 font-heading">{maxRate > 0 ? `${maxRate.toFixed(1)}%` : '¿?'}<span className="text-[10px] font-normal text-muted-foreground"> /mes</span></p>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <p className="text-[10px] text-muted-foreground">Invertir seguro rinde</p>
                                    <p className="text-lg font-bold text-emerald-300 font-heading">~inflación</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {maxRate >= EXPENSIVE_DEBT_MONTHLY_PCT
                                    ? `Cada $10.000 que le sacás a esa deuda te ahorran ~${formatCurrency(10000 * maxRate / 100)} por mes, garantizado. Ninguna inversión segura te da eso. Por eso el grueso va a deuda y la inversión arranca chica: el objetivo hoy es el hábito.`
                                    : maxRate > 0
                                        ? 'Tus deudas cobran poco: pagalas al día y no las adelantes. Con inflación, una cuota fija pesa cada mes menos. Ahí sí conviene invertir en paralelo.'
                                        : 'Cargá la tasa de tus deudas en la pestaña Deudas: sin eso no se puede saber si conviene adelantar pagos o invertir.'}
                            </p>
                        </>
                    ) : (
                        <p className="text-[11px] text-muted-foreground">No tenés deudas cargadas: todo lo que no va a necesidades y gustos puede ir a colchón e inversión.</p>
                    )}
                </div>

                {/* Interés compuesto */}
                <div className="glass rounded-3xl p-5 border border-border/50 space-y-3">
                    <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-400" /> Si invertís {formatCurrency(investMonthly)} por mes</h3>
                    {investMonthly > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="text-left font-semibold py-1">Años</th>
                                            {SCENARIOS.map(s => <th key={s.pct} className="text-right font-semibold py-1">{s.label} ({s.pct}%)</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[1, 5, 10, 20].map(y => (
                                            <tr key={y} className="border-t border-white/5">
                                                <td className="py-1.5 text-white">{y}</td>
                                                {SCENARIOS.map(s => {
                                                    const fv = futureValue(investMonthly, y, s.pct)
                                                    return (
                                                        <td key={s.pct} className="py-1.5 text-right">
                                                            <span className="font-mono text-white">{formatCurrency(fv)}</span>
                                                            <span className="block text-[9px] text-emerald-300/80">{formatCurrency(passiveIncome(fv))}/mes</span>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed flex gap-1">
                                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                En pesos de hoy (rendimiento real anual, ya sin inflación). Abajo de cada capital, el ingreso pasivo que podría darte retirando 4% al año. Lo que más mueve estos números es subir el aporte, no la tasa.
                            </p>
                        </>
                    ) : (
                        <p className="text-[11px] text-muted-foreground">Asigná un % a Inversión para ver la proyección.</p>
                    )}
                </div>
            </div>

            {/* Asesor IA */}
            <div className="glass rounded-3xl p-5 border border-violet-500/25 bg-gradient-to-br from-violet-950/20 to-transparent space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-400" /> Plan de inversión personalizado
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Cruza tu reparto, tus deudas, tus gastos y tu perfil. Te dice dónde poner cada peso y qué hacer este mes.
                            {adviceAt && <> Último: {new Date(adviceAt).toLocaleDateString('es-AR')}.</>}
                        </p>
                    </div>
                    <button
                        onClick={handleAdvice}
                        disabled={advising}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/20 disabled:opacity-60 self-start"
                    >
                        {advising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {advice ? 'Actualizar plan' : 'Armar mi plan'}
                    </button>
                </div>

                {adviceError && (
                    <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {adviceError}
                    </p>
                )}

                {advice && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-white">{advice.headline}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{advice.phase_explanation}</p>
                        </div>
                        {advice.debt_vs_invest && (
                            <p className="text-xs text-white/90 p-3 rounded-2xl bg-red-500/5 border border-red-500/15 leading-relaxed">{advice.debt_vs_invest}</p>
                        )}
                        {advice.where_to_put.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dónde va cada peso</p>
                                {advice.where_to_put.map((w, i) => (
                                    <div key={i} className="p-3 rounded-2xl bg-black/20 border border-white/5">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-bold text-white">{w.bucket}: <span className="text-violet-200">{w.instrument}</span></p>
                                            {w.amount > 0 && <span className="text-[11px] font-mono text-emerald-300 shrink-0">{formatCurrency(w.amount)}/mes</span>}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{w.why}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {advice.first_steps.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Este mes</p>
                                {advice.first_steps.map((s, i) => (
                                    <p key={i} className="text-xs text-white flex gap-2">
                                        <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-200 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{s}
                                    </p>
                                ))}
                            </div>
                        )}
                        {advice.passive_income_reality && (
                            <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/15">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-0.5">Ingreso pasivo, en serio</p>
                                <p className="text-xs text-white/90 leading-relaxed">{advice.passive_income_reality}</p>
                            </div>
                        )}
                        {advice.income_ideas.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">La palanca más grande: subir el ingreso</p>
                                {advice.income_ideas.map((s, i) => (
                                    <p key={i} className="text-xs text-white flex gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />{s}</p>
                                ))}
                            </div>
                        )}
                        {advice.warnings.length > 0 && (
                            <div className="space-y-1">
                                {advice.warnings.map((w, i) => (
                                    <p key={i} className="text-[11px] text-red-200/90 flex gap-1.5"><AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />{w}</p>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Catálogo */}
            <div className="glass rounded-3xl p-5 border border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-heading font-bold text-base text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Opciones en Argentina</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">De menor a mayor riesgo. El colchón va siempre en lo de arriba.</p>
                    </div>
                    <div className="flex gap-1.5">
                        {(['todos', 'colchon', 'inversion'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setCatalogFilter(f)}
                                className={cn(
                                    'px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                                    catalogFilter === f ? 'bg-white/15 border-white/40 text-white' : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                )}
                            >
                                {f === 'todos' ? 'Todas' : f === 'colchon' ? 'Para el colchón' : 'Para invertir'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {INVESTMENT_OPTIONS
                        .filter(o => catalogFilter === 'todos' || o.bucket === catalogFilter || o.bucket === 'ambos')
                        .map(o => (
                            <div key={o.id} className="p-3.5 rounded-2xl bg-black/20 border border-white/5 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-bold text-white">{o.name}</p>
                                    <span className="text-[9px] font-bold text-muted-foreground border border-white/10 rounded px-1.5 py-0.5 shrink-0">{o.currency}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1" title={`Riesgo ${o.risk} de 5`}>
                                        Riesgo
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <span key={i} className={cn('w-1.5 h-1.5 rounded-full', i <= o.risk ? (o.risk >= 4 ? 'bg-red-400' : o.risk === 3 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-white/15')} />
                                        ))}
                                        <span className="text-white/70">{o.risk}/5</span>
                                    </span>
                                    <span>Liquidez: <span className="text-white/80">{o.liquidity}</span></span>
                                </div>
                                <p className="text-[11px] text-white/85">{o.what}</p>
                                <p className="text-[11px] text-emerald-300/90 flex gap-1"><Check className="w-3 h-3 shrink-0 mt-0.5" />{o.goodFor}</p>
                                <p className="text-[11px] text-amber-200/80 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{o.watchOut}</p>
                                <p className="text-[10px] text-muted-foreground">Dónde: {o.where}</p>
                            </div>
                        ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed flex gap-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    Es orientación general, no asesoramiento financiero regulado. Las tasas cambian todo el tiempo: antes de invertir compará la tasa del día contra la inflación esperada y operá solo con bancos y ALyCs registradas en la CNV.
                </p>
            </div>
        </div>
    )
}

function MoneyField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
    return (
        <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
            <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/60">
                <span className="text-muted-foreground text-sm">$</span>
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-sm text-white font-mono focus:outline-none"
                />
            </div>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
    )
}
