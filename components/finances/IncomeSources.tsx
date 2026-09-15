'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Trash2, X, Loader2, Check, Wallet, Repeat, Dice5, Layers, Banknote
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    saveIncomeSource, deleteIncomeSource, registerIncomeReceived,
    type IncomeSourceItem, type IncomeKind, type IncomeConfidence
} from '@/lib/actions/income_sources'
import { formatCurrency, cn } from '@/lib/utils'

interface Props {
    sources: IncomeSourceItem[]
    range: { floor: number; ceiling: number; sources: number }
}

const KINDS: { value: IncomeKind; label: string; icon: any; hint: string }[] = [
    { value: 'fixed', label: 'Fijo', icon: Banknote, hint: 'Entra todos los meses, siempre el mismo monto. Tu sueldo.' },
    { value: 'variable', label: 'Variable', icon: Dice5, hint: 'Depende de si conseguís el trabajo. Puede no entrar.' },
    { value: 'installments', label: 'En cuotas', icon: Layers, hint: 'Un trabajo que cobrás en 2, 3 o 4 pagos.' },
    { value: 'recurring', label: 'Recurrente', icon: Repeat, hint: 'Un cliente que paga todos los meses (o cada X meses).' }
]

const CONFIDENCE: { value: IncomeConfidence; label: string; style: string }[] = [
    { value: 'confirmada', label: 'Seguro que entra', style: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
    { value: 'probable', label: 'Probable', style: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
    { value: 'incierta', label: 'Incierto', style: 'bg-secondary border-border text-muted-foreground' }
]

const EMPTY = {
    id: '',
    name: '',
    kind: 'fixed' as IncomeKind,
    amount: '',
    client: '',
    confidence: 'confirmada' as IncomeConfidence,
    expected_day: '',
    installments_total: '',
    installments_paid: '0',
    frequency_months: '1',
    notes: ''
}

export function IncomeSources({ sources, range }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ ...EMPTY })
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    function openCreate() {
        setForm({ ...EMPTY })
        setOpen(true)
    }

    function openEdit(s: IncomeSourceItem) {
        setForm({
            id: s.id,
            name: s.name,
            kind: s.kind,
            amount: String(s.amount),
            client: s.client || '',
            confidence: s.confidence,
            expected_day: s.expected_day ? String(s.expected_day) : '',
            installments_total: s.installments_total ? String(s.installments_total) : '',
            installments_paid: String(s.installments_paid),
            frequency_months: String(s.frequency_months),
            notes: s.notes || ''
        })
        setOpen(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await saveIncomeSource({
            id: form.id || undefined,
            name: form.name,
            kind: form.kind,
            amount: Number(form.amount) || 0,
            client: form.client || null,
            confidence: form.confidence,
            expected_day: form.expected_day ? Number(form.expected_day) : null,
            installments_total: form.installments_total ? Number(form.installments_total) : null,
            installments_paid: Number(form.installments_paid) || 0,
            frequency_months: Number(form.frequency_months) || 1,
            notes: form.notes || null
        })
        setSaving(false)
        if ('error' in res && res.error) return alert(res.error)
        setOpen(false)
        router.refresh()
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta fuente de ingreso?')) return
        setBusyId(id)
        await deleteIncomeSource(id)
        setBusyId(null)
        router.refresh()
    }

    async function handleReceived(s: IncomeSourceItem) {
        if (!confirm(`¿Registrar que cobraste ${formatCurrency(s.amount)} de "${s.name}"?`)) return
        setBusyId(s.id)
        const res = await registerIncomeReceived(s.id)
        setBusyId(null)
        if ('error' in res && res.error) return alert(res.error)
        router.refresh()
    }

    const byKind = (k: IncomeKind) => sources.filter(s => s.kind === k)

    return (
        <div className="space-y-5">
            {/* Piso y techo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl border border-emerald-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Piso del mes
                    </p>
                    <h3 className="text-2xl font-bold font-heading text-emerald-400">{formatCurrency(range.floor)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">solo lo que entra seguro</p>
                </div>
                <div className="glass p-5 rounded-2xl border border-amber-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Techo del mes
                    </p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(range.ceiling)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">si entra absolutamente todo</p>
                </div>
                <div className="glass p-5 rounded-2xl border border-indigo-500/25">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Lo que no controlás
                    </p>
                    <h3 className="text-2xl font-bold font-heading text-white">
                        {formatCurrency(range.ceiling - range.floor)}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">depende de que salgan trabajos</p>
                </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-border/50">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Un solo número de "ingreso mensual" no representa tu situación. Acá cada tipo se carga aparte:
                    el sueldo fijo, los trabajos que pueden salir o no, los que cobrás en varios pagos y los clientes
                    recurrentes. Con eso el sistema razona con un <strong className="text-foreground">piso</strong> y
                    un <strong className="text-foreground">techo</strong> en vez de un promedio que no existe ningún mes.
                </p>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" /> Tus fuentes de ingreso
                </h3>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                    <Plus className="w-4 h-4" /> Nueva fuente
                </button>
            </div>

            {sources.length === 0 && (
                <div className="glass rounded-2xl p-10 border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">
                        Cargá al menos tu ingreso fijo para que el asesor pueda trabajar.
                    </p>
                </div>
            )}

            {KINDS.map(k => {
                const list = byKind(k.value)
                if (!list.length) return null
                const Icon = k.icon
                return (
                    <div key={k.value} className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-indigo-400" /> {k.label}
                        </h4>
                        {list.map(s => {
                            const conf = CONFIDENCE.find(c => c.value === s.confidence)
                            return (
                                <div key={s.id} className="glass rounded-2xl p-4 border border-border/50 space-y-2.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h5 className="text-sm font-bold text-white">{s.name}</h5>
                                                {conf && (
                                                    <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-semibold', conf.style)}>
                                                        {conf.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                                                {s.client && <span>{s.client}</span>}
                                                {s.expected_day && <span>entra cerca del día {s.expected_day}</span>}
                                                {s.kind === 'installments' && s.installments_total && (
                                                    <span className="text-sky-300">
                                                        pago {s.installments_paid + 1} de {s.installments_total}
                                                    </span>
                                                )}
                                                {s.kind === 'recurring' && s.frequency_months > 1 && (
                                                    <span>cada {s.frequency_months} meses</span>
                                                )}
                                            </div>
                                            {s.notes && <p className="text-[10px] text-muted-foreground mt-1">{s.notes}</p>}
                                        </div>
                                        <span className="font-mono font-bold text-white text-base shrink-0">
                                            {formatCurrency(s.amount)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                                        <button
                                            onClick={() => handleReceived(s)}
                                            disabled={busyId === s.id}
                                            className="px-2.5 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/25 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                            Ya lo cobré
                                        </button>
                                        <button
                                            onClick={() => openEdit(s)}
                                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground rounded-lg text-[10px] font-semibold"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(s.id)}
                                            className="ml-auto p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            })}

            {/* Modal */}
            <AnimatePresence>
                {open && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                            className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-secondary/90 backdrop-blur-xl border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-secondary/95 backdrop-blur-xl z-10">
                                <h3 className="font-semibold text-foreground text-sm">
                                    {form.id ? 'Editar fuente de ingreso' : 'Nueva fuente de ingreso'}
                                </h3>
                                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-4 space-y-3.5">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-foreground">Qué tipo de ingreso es</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {KINDS.map(k => (
                                            <button
                                                key={k.value}
                                                type="button"
                                                onClick={() => setForm(f => ({
                                                    ...f,
                                                    kind: k.value,
                                                    confidence: k.value === 'variable' ? 'probable' : f.confidence
                                                }))}
                                                className={cn(
                                                    'px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all text-left',
                                                    form.kind === k.value
                                                        ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-200'
                                                        : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                                )}
                                            >
                                                {k.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-0.5">
                                        {KINDS.find(k => k.value === form.kind)?.hint}
                                    </p>
                                </div>

                                <Field label="Nombre" required>
                                    <input
                                        required
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Ej: Sueldo / Branding para Panadería X"
                                        className={inputCls}
                                    />
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Monto por cobro" required>
                                        <input
                                            required type="number" step="0.01" min="0"
                                            value={form.amount}
                                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Día estimado de cobro">
                                        <input
                                            type="number" min="1" max="31"
                                            value={form.expected_day}
                                            onChange={e => setForm(f => ({ ...f, expected_day: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>

                                <Field label="Cliente / de dónde viene">
                                    <input
                                        value={form.client}
                                        onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>

                                {form.kind === 'installments' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Cantidad de pagos" required>
                                            <input
                                                type="number" min="1" max="24"
                                                value={form.installments_total}
                                                onChange={e => setForm(f => ({ ...f, installments_total: e.target.value }))}
                                                className={inputCls}
                                            />
                                        </Field>
                                        <Field label="Ya cobré">
                                            <input
                                                type="number" min="0"
                                                value={form.installments_paid}
                                                onChange={e => setForm(f => ({ ...f, installments_paid: e.target.value }))}
                                                className={inputCls}
                                            />
                                        </Field>
                                    </div>
                                )}

                                {form.kind === 'recurring' && (
                                    <Field label="Cada cuántos meses" hint="1 = todos los meses.">
                                        <input
                                            type="number" min="1" max="12"
                                            value={form.frequency_months}
                                            onChange={e => setForm(f => ({ ...f, frequency_months: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-foreground">¿Qué tan seguro es?</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {CONFIDENCE.map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, confidence: c.value }))}
                                                className={cn(
                                                    'px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all',
                                                    form.confidence === c.value
                                                        ? c.style
                                                        : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                                )}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-0.5">
                                        Solo lo confirmado cuenta para el piso del mes. Lo demás es upside, no presupuesto.
                                    </p>
                                </div>

                                <Field label="Notas">
                                    <input
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Guardar fuente
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

const inputCls = 'w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
                {label} {required && <span className="text-emerald-400">*</span>}
            </label>
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
            {children}
        </div>
    )
}
