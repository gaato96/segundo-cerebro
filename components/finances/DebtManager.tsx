'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Landmark, Plus, Trash2, X, Loader2, TrendingUp, AlertTriangle,
    CalendarClock, Calculator, HelpCircle, Check, Flame, Receipt, Percent
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    saveDebt, deleteDebtById, addDebtObservation, deleteDebtObservation,
    simulatePaymentPlan, setPaymentPlan, cancelPaymentPlan, payInstallment, payDebtAmount,
    type DebtsOverview, type DebtView
} from '@/lib/actions/debts'
import { formatCurrency, getLocalDateStr, cn } from '@/lib/utils'
import type { InterestType } from '@/lib/debtMath'

interface Props {
    overview: DebtsOverview
}

const KINDS: { value: string; label: string }[] = [
    { value: 'tarjeta', label: '💳 Tarjeta' },
    { value: 'prestamo', label: '🏦 Préstamo' },
    { value: 'particular', label: '🤝 Particular' },
    { value: 'servicio', label: '🔌 Servicio' },
    { value: 'impuesto', label: '🏛️ Impuesto' },
    { value: 'otro', label: '📄 Otro' }
]

const EMPTY_FORM = {
    id: '' as string,
    creditor: '',
    kind: 'otro',
    total_amount: '',
    remaining_amount: '',
    interest_type: 'monthly' as InterestType,
    interest_rate_pct: '',
    interest_unknown: false,
    interest_capitalizes: true,
    minimum_payment: '',
    due_day: '',
    notes: ''
}

export function DebtManager({ overview }: Props) {
    const router = useRouter()
    const { debts, totals } = overview

    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState({ ...EMPTY_FORM })
    const [saving, setSaving] = useState(false)

    const [obsFor, setObsFor] = useState<DebtView | null>(null)
    const [planFor, setPlanFor] = useState<DebtView | null>(null)
    const [payFor, setPayFor] = useState<DebtView | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    function openCreate() {
        setForm({ ...EMPTY_FORM })
        setFormOpen(true)
    }

    function openEdit(d: DebtView) {
        setForm({
            id: d.id,
            creditor: d.creditor,
            kind: d.kind,
            total_amount: String(d.total_amount),
            remaining_amount: String(d.remaining_amount),
            interest_type: d.interest_type === 'none' ? 'monthly' : d.interest_type,
            interest_rate_pct: d.interest_rate_pct ? String(d.interest_rate_pct) : '',
            interest_unknown: d.interest_unknown || (d.interest_type === 'none' && !d.interest_rate_pct),
            interest_capitalizes: d.interest_capitalizes,
            minimum_payment: d.minimum_payment ? String(d.minimum_payment) : '',
            due_day: d.due_day ? String(d.due_day) : '',
            notes: d.notes || ''
        })
        setFormOpen(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await saveDebt({
            id: form.id || undefined,
            creditor: form.creditor,
            kind: form.kind,
            total_amount: Number(form.total_amount),
            remaining_amount: form.remaining_amount ? Number(form.remaining_amount) : undefined,
            interest_type: form.interest_type,
            interest_rate_pct: Number(form.interest_rate_pct) || 0,
            interest_unknown: form.interest_unknown,
            interest_capitalizes: form.interest_capitalizes,
            minimum_payment: form.minimum_payment ? Number(form.minimum_payment) : null,
            due_day: form.due_day ? Number(form.due_day) : null,
            notes: form.notes || null
        })
        setSaving(false)
        if ('error' in res && res.error) return alert(res.error)
        setFormOpen(false)
        router.refresh()
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta deuda y todo su historial de saldos?')) return
        setBusyId(id)
        await deleteDebtById(id)
        setBusyId(null)
        router.refresh()
    }

    async function handlePayInstallment(d: DebtView) {
        if (!confirm(`¿Registrar el pago de la cuota de ${formatCurrency(d.plan_installment_amount || 0)} a ${d.creditor}?`)) return
        setBusyId(d.id)
        const res = await payInstallment(d.id)
        setBusyId(null)
        if ('error' in res && res.error) return alert(res.error)
        router.refresh()
    }

    async function handleCancelPlan(d: DebtView) {
        if (!confirm(`¿Dar de baja el plan de pago de ${d.creditor}? La deuda vuelve a figurar como abierta.`)) return
        setBusyId(d.id)
        await cancelPaymentPlan(d.id)
        setBusyId(null)
        router.refresh()
    }

    const openDebts = debts.filter(d => d.remaining_amount > 0)
    const closedDebts = debts.filter(d => d.remaining_amount <= 0)

    return (
        <div className="space-y-5">
            {/* Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-red-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deuda Total</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(totals.remaining)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">{openDebts.length} deudas abiertas</p>
                </div>

                <div className="glass p-5 rounded-2xl border border-orange-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Te corre por día</p>
                    <h3 className="text-2xl font-bold font-heading text-orange-400">{formatCurrency(totals.dailyCost)}</h3>
                    <p className="text-[10px] text-orange-300/80 mt-1 font-semibold flex items-center gap-1">
                        <Flame className="w-3 h-3" /> {formatCurrency(totals.monthlyCost)} al mes de puro interés
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-amber-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">En 30 días serán</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(totals.in30Days)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">si no pagás nada</p>
                </div>

                <div className="glass p-5 rounded-2xl border border-indigo-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cuotas comprometidas</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(totals.monthlyInstallments)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">por mes, en planes activos</p>
                </div>
            </div>

            {totals.withUnknownRate > 0 && (
                <div className="glass p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-2.5">
                    <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                        Tenés <strong>{totals.withUnknownRate}</strong>{' '}
                        {totals.withUnknownRate === 1 ? 'deuda' : 'deudas'} sin tasa conocida. No hace falta que el
                        acreedor te la diga: tocá <strong>Anotar saldo real</strong> en dos fechas distintas y el
                        sistema calcula solo cuánto interés te están cobrando por día.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-indigo-400" /> Tus deudas
                </h3>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                    <Plus className="w-4 h-4" /> Nueva deuda
                </button>
            </div>

            {openDebts.length === 0 && (
                <div className="glass rounded-2xl p-10 border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">No tenés deudas abiertas cargadas.</p>
                </div>
            )}

            <div className="space-y-3">
                {openDebts.map(d => (
                    <div
                        key={d.id}
                        className={cn(
                            'glass rounded-2xl p-4 border space-y-3',
                            d.plan_active
                                ? 'border-sky-500/30 bg-sky-500/5'
                                : d.dailyCost > 0
                                    ? 'border-orange-500/25'
                                    : 'border-border/50'
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-white">{d.creditor}</h4>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground">
                                        {KINDS.find(k => k.value === d.kind)?.label || d.kind}
                                    </span>
                                    {d.plan_active && (
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-semibold">
                                            En plan de pago
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
                                    {d.rateSource === 'sin_datos' ? (
                                        <span className="text-amber-400 flex items-center gap-1">
                                            <HelpCircle className="w-3 h-3" /> Tasa desconocida
                                        </span>
                                    ) : (
                                        <span className="text-orange-300 flex items-center gap-1">
                                            <Percent className="w-3 h-3" />
                                            {d.dailyRatePct.toFixed(3)}%/día ≈ {d.monthlyRatePct.toFixed(1)}%/mes
                                            <span className="text-muted-foreground">({d.rateSource})</span>
                                        </span>
                                    )}
                                    {d.due_day && (
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <CalendarClock className="w-3 h-3" /> vence el {d.due_day}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="font-mono font-bold text-white text-base">{formatCurrency(d.remaining_amount)}</p>
                                {d.total_amount > d.remaining_amount && (
                                    <p className="text-[10px] text-muted-foreground">de {formatCurrency(d.total_amount)}</p>
                                )}
                            </div>
                        </div>

                        {/* El costo real de tenerla */}
                        {d.dailyCost > 0 && !d.plan_active && (
                            <div className="flex flex-wrap gap-2 text-[10px]">
                                <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-300 font-semibold">
                                    {formatCurrency(d.dailyCost)} por día
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 font-semibold">
                                    +{formatCurrency(d.interest30Days)} en 30 días
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-secondary/60 border border-border text-muted-foreground">
                                    en un mes: {formatCurrency(d.in30Days)}
                                </span>
                            </div>
                        )}

                        {/* Estado del plan */}
                        {d.plan_active && d.plan_installments && (
                            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-sky-200 font-semibold">
                                        Cuota {d.plan_installments_paid + 1} de {d.plan_installments} · {formatCurrency(d.plan_installment_amount || 0)}
                                    </span>
                                    <span className="text-muted-foreground">
                                        faltan {formatCurrency(d.remainingUnderPlan || 0)}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-sky-500 rounded-full transition-all"
                                        style={{ width: `${Math.min((d.plan_installments_paid / d.plan_installments) * 100, 100)}%` }}
                                    />
                                </div>
                                {d.plan_due_day && (
                                    <p className="text-[10px] text-muted-foreground">Vence el día {d.plan_due_day} de cada mes.</p>
                                )}
                                {d.plan_notes && <p className="text-[10px] text-muted-foreground">{d.plan_notes}</p>}
                            </div>
                        )}

                        {/* Acciones */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                            {d.plan_active ? (
                                <>
                                    <button
                                        onClick={() => handlePayInstallment(d)}
                                        disabled={busyId === d.id}
                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busyId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        Pagué la cuota
                                    </button>
                                    <button
                                        onClick={() => handleCancelPlan(d)}
                                        className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground rounded-lg text-[10px] font-semibold"
                                    >
                                        Dar de baja el plan
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setPlanFor(d)}
                                    className="px-2.5 py-1.5 bg-sky-600/15 hover:bg-sky-600/30 text-sky-300 border border-sky-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                                >
                                    <Calculator className="w-3 h-3" /> Arreglé un plan de pago
                                </button>
                            )}

                            <button
                                onClick={() => setPayFor(d)}
                                className="px-2.5 py-1.5 bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                            >
                                <Receipt className="w-3 h-3" /> Registrar pago
                            </button>

                            <button
                                onClick={() => setObsFor(d)}
                                className={cn(
                                    'px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border',
                                    d.rateSource === 'sin_datos'
                                        ? 'bg-amber-600/20 hover:bg-amber-600/35 text-amber-200 border-amber-500/30'
                                        : 'bg-secondary hover:bg-secondary/70 text-muted-foreground border-border'
                                )}
                            >
                                <TrendingUp className="w-3 h-3" />
                                Anotar saldo real {d.observations.length > 0 && `(${d.observations.length})`}
                            </button>

                            <button
                                onClick={() => openEdit(d)}
                                className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground rounded-lg text-[10px] font-semibold"
                            >
                                Editar
                            </button>

                            <button
                                onClick={() => handleDelete(d.id)}
                                className="ml-auto p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {closedDebts.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Saldadas</h4>
                    {closedDebts.map(d => (
                        <div key={d.id} className="glass rounded-xl p-3 border border-emerald-500/20 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground line-through">{d.creditor}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-emerald-400 font-semibold">Pagada</span>
                                <button onClick={() => handleDelete(d.id)} className="text-muted-foreground hover:text-red-400">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modales */}
            <AnimatePresence>
                {formOpen && (
                    <Modal onClose={() => setFormOpen(false)} title={form.id ? 'Editar deuda' : 'Nueva deuda'}>
                        <form onSubmit={handleSave} className="space-y-3.5">
                            <Field label="¿A quién le debés?" required>
                                <input
                                    required
                                    value={form.creditor}
                                    onChange={e => setForm(f => ({ ...f, creditor: e.target.value }))}
                                    placeholder="Ej: Tarjeta Visa Galicia"
                                    className={inputCls}
                                />
                            </Field>

                            <Field label="Tipo de deuda">
                                <div className="grid grid-cols-3 gap-1.5">
                                    {KINDS.map(k => (
                                        <button
                                            key={k.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, kind: k.value }))}
                                            className={cn(
                                                'px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all',
                                                form.kind === k.value
                                                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                                                    : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                            )}
                                        >
                                            {k.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Monto original" required>
                                    <input
                                        required type="number" step="0.01" min="0"
                                        value={form.total_amount}
                                        onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Saldo actual" hint="Si está vacío, se usa el monto original.">
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={form.remaining_amount}
                                        onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                            </div>

                            {/* Interés */}
                            <div className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.interest_unknown}
                                        onChange={e => setForm(f => ({ ...f, interest_unknown: e.target.checked }))}
                                        className="w-4 h-4 rounded accent-amber-500"
                                    />
                                    <span className="text-[11px] font-semibold text-amber-300">
                                        No sé qué interés me cobran
                                    </span>
                                </label>

                                {form.interest_unknown ? (
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        Sin problema. Guardá la deuda y después usá <strong>Anotar saldo real</strong>:
                                        con dos saldos en fechas distintas, el sistema deduce la tasa diaria sola.
                                    </p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Cada cuánto">
                                                <select
                                                    value={form.interest_type}
                                                    onChange={e => setForm(f => ({ ...f, interest_type: e.target.value as InterestType }))}
                                                    className={inputCls}
                                                >
                                                    <option value="daily">Por día</option>
                                                    <option value="monthly">Por mes</option>
                                                    <option value="annual">Por año</option>
                                                    <option value="none">Sin interés</option>
                                                </select>
                                            </Field>
                                            <Field label="Tasa (%)">
                                                <input
                                                    type="number" step="0.0001" min="0"
                                                    value={form.interest_rate_pct}
                                                    onChange={e => setForm(f => ({ ...f, interest_rate_pct: e.target.value }))}
                                                    placeholder={form.interest_type === 'daily' ? '0.5' : '8'}
                                                    className={inputCls}
                                                />
                                            </Field>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.interest_capitalizes}
                                                onChange={e => setForm(f => ({ ...f, interest_capitalizes: e.target.checked }))}
                                                className="w-4 h-4 rounded accent-indigo-500"
                                            />
                                            <span className="text-[11px] text-muted-foreground">
                                                El interés se capitaliza (se cobra interés sobre el interés)
                                            </span>
                                        </label>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Pago mínimo">
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={form.minimum_payment}
                                        onChange={e => setForm(f => ({ ...f, minimum_payment: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Día de vencimiento">
                                    <input
                                        type="number" min="1" max="31"
                                        value={form.due_day}
                                        onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                            </div>

                            <Field label="Notas">
                                <textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Con quién hablaste, qué te dijeron, condiciones..."
                                    className={cn(inputCls, 'resize-none')}
                                />
                            </Field>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Guardar deuda
                            </button>
                        </form>
                    </Modal>
                )}

                {obsFor && (
                    <ObservationsModal
                        debt={obsFor}
                        onClose={() => setObsFor(null)}
                        onDone={() => { setObsFor(null); router.refresh() }}
                    />
                )}

                {planFor && (
                    <PaymentPlanModal
                        debt={planFor}
                        onClose={() => setPlanFor(null)}
                        onDone={() => { setPlanFor(null); router.refresh() }}
                    />
                )}

                {payFor && (
                    <PayModal
                        debt={payFor}
                        onClose={() => setPayFor(null)}
                        onDone={() => { setPayFor(null); router.refresh() }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ============================================================
// Observaciones: deducir la tasa
// ============================================================

function ObservationsModal({ debt, onClose, onDone }: { debt: DebtView; onClose: () => void; onDone: () => void }) {
    const [date, setDate] = useState(getLocalDateStr())
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<any>(null)

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await addDebtObservation(debt.id, date, Number(amount), note || undefined)
        setSaving(false)
        if ('error' in res && res.error) return alert(res.error)
        setResult(res)
        setAmount('')
        setNote('')
    }

    return (
        <Modal onClose={onClose} title={`Saldos reales · ${debt.creditor}`}>
            <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cada vez que sepas cuánto debés de verdad (te lo dijeron, lo viste en el resumen, entraste al
                    homebanking), anotalo acá con la fecha. Con dos anotaciones en fechas distintas el sistema
                    calcula solo qué tasa te están cobrando, sin que nadie te la tenga que decir.
                </p>

                <form onSubmit={handleAdd} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Fecha">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Saldo ese día" required>
                            <input
                                required type="number" step="0.01" min="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className={inputCls}
                            />
                        </Field>
                    </div>
                    <Field label="Nota">
                        <input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Me lo dijo el gestor por teléfono"
                            className={inputCls}
                        />
                    </Field>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Anotar este saldo
                    </button>
                </form>

                {result?.estimated != null && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                        <p className="text-[11px] font-bold text-emerald-300">
                            Tasa deducida: {Number(result.estimated).toFixed(3)}% por día
                            {result.monthlyEquivalent != null && ` (≈ ${Number(result.monthlyEquivalent).toFixed(1)}% mensual)`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            Calculada entre el {result.from} y el {result.to}
                            {result.paymentsConsidered > 0 && `, descontando ${formatCurrency(result.paymentsConsidered)} de pagos registrados`}.
                        </p>
                    </div>
                )}

                {result?.estimated == null && result?.reason && (
                    <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5">
                        {result.reason}
                    </p>
                )}

                {debt.observations.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Historial
                        </span>
                        {debt.observations.map(o => (
                            <div key={o.id} className="flex items-center justify-between text-[11px] bg-secondary/40 border border-border/50 rounded-lg px-2.5 py-2">
                                <div className="min-w-0">
                                    <span className="text-foreground font-mono">{formatCurrency(o.observed_amount)}</span>
                                    <span className="text-muted-foreground"> · {o.observed_on}</span>
                                    {o.note && <p className="text-[10px] text-muted-foreground truncate">{o.note}</p>}
                                </div>
                                <button
                                    onClick={async () => { await deleteDebtObservation(o.id, debt.id); onDone() }}
                                    className="text-muted-foreground hover:text-red-400 shrink-0"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={onDone}
                    className="w-full py-2.5 bg-secondary hover:bg-secondary/70 border border-border text-foreground rounded-xl text-xs font-semibold"
                >
                    Listo
                </button>
            </div>
        </Modal>
    )
}

// ============================================================
// Plan de pago
// ============================================================

function PaymentPlanModal({ debt, onClose, onDone }: { debt: DebtView; onClose: () => void; onDone: () => void }) {
    const [installments, setInstallments] = useState('3')
    const [installmentAmount, setInstallmentAmount] = useState('')
    const [dueDay, setDueDay] = useState(debt.due_day ? String(debt.due_day) : '')
    const [firstDue, setFirstDue] = useState('')
    const [notes, setNotes] = useState('')
    const [sim, setSim] = useState<any>(null)
    const [busy, setBusy] = useState(false)

    async function handleSimulate() {
        if (!installments || !installmentAmount) return
        setBusy(true)
        const res = await simulatePaymentPlan(debt.id, Number(installments), Number(installmentAmount))
        setBusy(false)
        if ('error' in res && res.error) return alert(res.error)
        setSim(res)
    }

    async function handleConfirm() {
        setBusy(true)
        const res = await setPaymentPlan({
            debtId: debt.id,
            installments: Number(installments),
            installmentAmount: Number(installmentAmount),
            firstDueDate: firstDue || null,
            dueDay: dueDay ? Number(dueDay) : null,
            notes: notes || null
        })
        setBusy(false)
        if ('error' in res && res.error) return alert(res.error)
        onDone()
    }

    return (
        <Modal onClose={onClose} title={`Plan de pago · ${debt.creditor}`}>
            <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cargá las condiciones que te ofrecieron. Antes de confirmar, simulá: te digo si financiar te
                    ahorra plata o solo te compra aire, y cuánto cuesta ese aire.
                </p>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground">
                    Saldo actual: <strong className="text-foreground font-mono">{formatCurrency(debt.remaining_amount)}</strong>
                    {debt.dailyCost > 0 && <> · hoy te corre {formatCurrency(debt.dailyCost)} por día</>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Cuántas cuotas" required>
                        <input
                            type="number" min="1" max="120"
                            value={installments}
                            onChange={e => { setInstallments(e.target.value); setSim(null) }}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Monto de cada cuota" required>
                        <input
                            type="number" step="0.01" min="0"
                            value={installmentAmount}
                            onChange={e => { setInstallmentAmount(e.target.value); setSim(null) }}
                            className={inputCls}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Primera cuota">
                        <input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Vence el día">
                        <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} className={inputCls} />
                    </Field>
                </div>

                <Field label="Notas del acuerdo">
                    <input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Con quién lo arreglaste, qué te prometieron..."
                        className={inputCls}
                    />
                </Field>

                <button
                    onClick={handleSimulate}
                    disabled={busy || !installmentAmount}
                    className="w-full py-2.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    ¿Me conviene?
                </button>

                {sim && (
                    <div className={cn(
                        'p-3 rounded-xl border space-y-1.5',
                        sim.verdict === 'conviene'
                            ? 'bg-emerald-500/10 border-emerald-500/25'
                            : sim.verdict === 'caro'
                                ? 'bg-amber-500/10 border-amber-500/25'
                                : 'bg-secondary/50 border-border'
                    )}>
                        <p className={cn(
                            'text-[11px] font-bold flex items-center gap-1.5',
                            sim.verdict === 'conviene' ? 'text-emerald-300' : sim.verdict === 'caro' ? 'text-amber-300' : 'text-muted-foreground'
                        )}>
                            {sim.verdict === 'caro' && <AlertTriangle className="w-3.5 h-3.5" />}
                            {sim.verdict === 'conviene' ? 'Conviene financiar' : sim.verdict === 'caro' ? 'Te da aire, pero sale caro' : 'Faltan datos para comparar'}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{sim.explanation}</p>
                        <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                            <p>Total del plan: <strong className="text-foreground font-mono">{formatCurrency(sim.planTotal)}</strong> ({formatCurrency(sim.extraOverBalance)} más que el saldo de hoy)</p>
                            {sim.doNothingAmount > 0 && (
                                <p>
                                    Si no hacés nada, en {installments} meses la deuda sería{' '}
                                    <strong className="text-foreground font-mono">{formatCurrency(sim.doNothingAmount)}</strong>
                                    {sim.savingsVsDoNothing > 0 && (
                                        <> — el plan te ahorra <strong className="text-emerald-400">{formatCurrency(sim.savingsVsDoNothing)}</strong></>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleConfirm}
                    disabled={busy || !installments || !installmentAmount}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirmar: ya arreglé este plan
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                    Al confirmar, la deuda deja de acumular la tasa vieja y la cuota pasa a contar como gasto fijo del mes.
                </p>
            </div>
        </Modal>
    )
}

// ============================================================
// Pago suelto
// ============================================================

function PayModal({ debt, onClose, onDone }: { debt: DebtView; onClose: () => void; onDone: () => void }) {
    const [amount, setAmount] = useState('')
    const [busy, setBusy] = useState(false)

    async function handlePay(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true)
        const res = await payDebtAmount(debt.id, Number(amount))
        setBusy(false)
        if ('error' in res && res.error) return alert(res.error)
        onDone()
    }

    return (
        <Modal onClose={onClose} title={`Registrar pago · ${debt.creditor}`}>
            <form onSubmit={handlePay} className="space-y-3.5">
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground">
                    Saldo actual: <strong className="text-foreground font-mono">{formatCurrency(debt.remaining_amount)}</strong>
                </div>
                <Field label="Cuánto pagaste" required>
                    <input
                        required autoFocus type="number" step="0.01" min="0"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className={inputCls}
                    />
                </Field>
                {debt.minimum_payment ? (
                    <button
                        type="button"
                        onClick={() => setAmount(String(debt.minimum_payment))}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                        Usar el pago mínimo ({formatCurrency(debt.minimum_payment)})
                    </button>
                ) : null}
                <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Registrar el pago
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                    Se descuenta del saldo y queda como movimiento del mes en Finanzas.
                </p>
            </form>
        </Modal>
    )
}

// ============================================================
// Primitivas de UI
// ============================================================

const inputCls = 'w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/40'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
                {label} {required && <span className="text-indigo-400">*</span>}
            </label>
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
            {children}
        </div>
    )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-secondary/90 backdrop-blur-xl border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
            >
                <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-secondary/95 backdrop-blur-xl z-10">
                    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </motion.div>
        </div>
    )
}
