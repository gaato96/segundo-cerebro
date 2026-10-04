'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Receipt, X, Loader2, Check, CalendarDays, Repeat, AlertTriangle } from 'lucide-react'
import {
    createQuickEntry, getQuickEntryContext,
    type QuickEntryContext, type ExpenseTemplate
} from '@/lib/actions/expenses'
import {
    EXPENSE_CATEGORIES, PAYMENT_METHODS, NECESSITY_LEVELS, getCategory, defaultNecessity,
    type Necessity, type PaymentMethod
} from '@/lib/expenseCategories'
import { formatCurrency, getLocalDateStr, cn } from '@/lib/utils'

/**
 * Registro rápido de gastos: botón flotante disponible en toda la app.
 * Atajo: Ctrl/Cmd + Shift + L. También se abre con el evento `sc:quick-expense`
 * (dashboard, command palette, cierre del día).
 *
 * Lo mínimo para guardar es monto + categoría. El resto tiene valor por defecto.
 */

const METHOD_KEY = 'sc_last_payment_method'
const INCOME_SOURCES = ['Sueldo', 'Freelance', 'Cliente', 'Venta', 'Reintegro', 'Otro']

/** Acepta "1500", "1.500", "1.500,50" o "1500.5". */
function parseAmount(raw: string): number {
    const s = raw.replace(/[^\d.,]/g, '')
    if (!s) return 0
    let normalized = s
    if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.')
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, '')
    const value = Number(normalized)
    return Number.isFinite(value) ? value : 0
}

function yesterdayOf(date: string): string {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d - 1))
    return dt.toISOString().slice(0, 10)
}

export function QuickExpenseButton() {
    const router = useRouter()
    const amountRef = useRef<HTMLInputElement>(null)

    const [open, setOpen] = useState(false)
    const [kind, setKind] = useState<'expense' | 'income'>('expense')
    const [amountRaw, setAmountRaw] = useState('')
    const [category, setCategory] = useState('')
    const [incomeSource, setIncomeSource] = useState('Sueldo')
    const [description, setDescription] = useState('')
    const [method, setMethod] = useState<PaymentMethod | null>(null)
    const [necessity, setNecessity] = useState<Necessity | null>(null)
    const [date, setDate] = useState(getLocalDateStr())
    const [recurring, setRecurring] = useState(false)
    const [showDate, setShowDate] = useState(false)

    const [ctx, setCtx] = useState<QuickEntryContext | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [saved, setSaved] = useState<{ todayTotal: number; todayCount: number } | null>(null)

    const today = ctx?.today || getLocalDateStr()
    const amount = parseAmount(amountRaw)

    // Abrir: botón, atajo de teclado o evento desde otra pantalla.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault()
                openSheet('expense')
            }
            if (e.key === 'Escape') setOpen(false)
        }
        const onRequest = (e: Event) => {
            const detail = (e as CustomEvent).detail
            openSheet(detail?.kind === 'income' ? 'income' : 'expense')
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('sc:quick-expense', onRequest)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('sc:quick-expense', onRequest)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function resetForm(keepMethod = true) {
        setAmountRaw('')
        setCategory('')
        setDescription('')
        setNecessity(null)
        setRecurring(false)
        setError('')
        setDate(getLocalDateStr())
        setShowDate(false)
        if (!keepMethod) setMethod(null)
    }

    async function openSheet(k: 'expense' | 'income') {
        resetForm()
        setKind(k)
        setSaved(null)
        setOpen(true)
        try {
            const savedMethod = localStorage.getItem(METHOD_KEY) as PaymentMethod | null
            if (savedMethod) setMethod(savedMethod)
        } catch { /* sin storage */ }
        setTimeout(() => amountRef.current?.focus(), 80)

        const res = await getQuickEntryContext().catch(() => null)
        if (res?.ok) {
            setCtx(res.data)
            setMethod(prev => prev || (res.data.lastMethod as PaymentMethod | null) || 'debito')
        }
    }

    // Las categorías que más usás, primero.
    const categories = useMemo(() => {
        const usage = ctx?.categoryUsage || {}
        return [...EXPENSE_CATEGORIES].sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))
    }, [ctx])

    function pickCategory(id: string) {
        // "¿Era necesario?" sigue a la categoría hasta que lo toques a mano.
        setCategory(id)
        if (!amountRaw) amountRef.current?.focus()
    }

    function applyTemplate(t: ExpenseTemplate) {
        setAmountRaw(String(Math.round(t.amount)))
        setCategory(t.category)
        setDescription(t.description === t.category ? '' : t.description)
        if (t.payment_method) setMethod(t.payment_method as PaymentMethod)
        setNecessity((t.necessity as Necessity) || defaultNecessity(t.category))
    }

    async function save(another: boolean) {
        setError('')
        if (!(amount > 0)) {
            setError('Poné el monto.')
            amountRef.current?.focus()
            return
        }
        if (kind === 'expense' && !category) {
            setError('Elegí una categoría.')
            return
        }

        setSaving(true)
        try {
            const res = await createQuickEntry({
                kind,
                amount,
                category: kind === 'income' ? incomeSource : category,
                description,
                date,
                payment_method: method,
                necessity: kind === 'expense' ? (necessity || defaultNecessity(category)) : null,
                recurring: kind === 'expense' && recurring
            })
            if (!res.ok) {
                setError(res.error)
                return
            }
            try { if (method) localStorage.setItem(METHOD_KEY, method) } catch { /* sin storage */ }

            setSaved(res.data)
            router.refresh()

            if (another) {
                resetForm()
                setTimeout(() => amountRef.current?.focus(), 50)
            } else {
                setTimeout(() => setOpen(false), 1100)
            }
        } catch (e: any) {
            setError(e?.message || 'No pude guardar. Revisá la conexión.')
        } finally {
            setSaving(false)
        }
    }

    const todayTotal = saved?.todayTotal ?? ctx?.todayTotal ?? 0
    const target = ctx?.dailyTarget || null
    const overTarget = target ? todayTotal > target : false
    const selectedCat = category ? getCategory(category) : null

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openSheet('expense')}
                title="Registrar gasto (Ctrl+Shift+L)"
                className="fixed bottom-[208px] md:bottom-40 right-5 z-40 bg-emerald-600 text-white p-3.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:bg-emerald-500 transition-colors flex items-center justify-center"
            >
                <Receipt className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                            className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#12141c] border border-emerald-500/25 shadow-2xl rounded-t-3xl sm:rounded-3xl"
                            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-[#12141c]/95 backdrop-blur px-5 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-xl p-0.5 w-fit">
                                        {(['expense', 'income'] as const).map(k => (
                                            <button
                                                key={k}
                                                onClick={() => { setKind(k); setError('') }}
                                                className={cn(
                                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                                                    kind === k
                                                        ? k === 'expense' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                                                        : 'text-muted-foreground hover:text-white'
                                                )}
                                            >
                                                {k === 'expense' ? 'Gasto' : 'Ingreso'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                        Hoy: <span className={cn('font-bold', overTarget ? 'text-red-400' : 'text-white')}>{formatCurrency(todayTotal)}</span>
                                        {target ? <> de {formatCurrency(target)} de tope</> : null}
                                        {ctx && ctx.avgPerDay > 0 && <> · tu promedio: {formatCurrency(ctx.avgPerDay)}/día</>}
                                    </p>
                                </div>
                                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-white p-1 shrink-0">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form
                                onSubmit={(e) => { e.preventDefault(); save(false) }}
                                className="px-5 pt-4 space-y-4"
                            >
                                {/* Monto */}
                                <div>
                                    <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-emerald-500/60">
                                        <span className="text-2xl font-bold text-muted-foreground">$</span>
                                        <input
                                            ref={amountRef}
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={amountRaw}
                                            onChange={(e) => setAmountRaw(e.target.value)}
                                            placeholder="0"
                                            className="flex-1 min-w-0 bg-transparent text-3xl font-bold font-mono text-white placeholder:text-white/20 focus:outline-none"
                                        />
                                    </div>
                                    {amount > 0 && amountRaw.replace(/\D/g, '').length > 3 && (
                                        <p className="text-[10px] text-muted-foreground mt-1 pl-1">{formatCurrency(amount)}</p>
                                    )}
                                </div>

                                {kind === 'expense' ? (
                                    <>
                                        {/* Repetir uno frecuente */}
                                        {ctx && ctx.templates.length > 0 && (
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Frecuentes</label>
                                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                                                    {ctx.templates.map(t => (
                                                        <button
                                                            key={`${t.description}-${t.category}`}
                                                            type="button"
                                                            onClick={() => applyTemplate(t)}
                                                            className="shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] bg-white/5 border border-white/10 text-white/90 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all whitespace-nowrap"
                                                        >
                                                            {getCategory(t.category).emoji} {t.description} · <span className="font-mono text-muted-foreground">{formatCurrency(t.amount)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Categoría */}
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Categoría</label>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                                {categories.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => pickCategory(c.id)}
                                                        title={c.hint}
                                                        className={cn(
                                                            'flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all',
                                                            category === c.id
                                                                ? 'bg-emerald-500/20 border-emerald-400 text-white'
                                                                : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5 hover:text-white'
                                                        )}
                                                    >
                                                        <span className="text-lg leading-none">{c.emoji}</span>
                                                        <span className="truncate w-full text-center">{c.id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">De dónde viene</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {INCOME_SOURCES.map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => setIncomeSource(s)}
                                                    className={cn(
                                                        'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                                        incomeSource === s
                                                            ? 'bg-indigo-600/30 border-indigo-400 text-white'
                                                            : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                                    )}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detalle */}
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={kind === 'income'
                                        ? 'Detalle (opcional): cliente, concepto...'
                                        : selectedCat?.hint ? `Detalle (opcional): ${selectedCat.hint}` : 'Detalle (opcional)'}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                />

                                {/* Medio de pago */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                        {kind === 'income' ? 'Cómo entró' : 'Cómo pagaste'}
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {PAYMENT_METHODS.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setMethod(p.id)}
                                                className={cn(
                                                    'px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                                                    method === p.id
                                                        ? 'bg-white/15 border-white/40 text-white'
                                                        : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                                )}
                                            >
                                                {p.emoji} {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ¿Era necesario? */}
                                {kind === 'expense' && (
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">¿Era necesario?</label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {NECESSITY_LEVELS.map(lvl => {
                                                const active = (necessity || (category ? defaultNecessity(category) : null)) === lvl.id
                                                return (
                                                    <button
                                                        key={lvl.id}
                                                        type="button"
                                                        onClick={() => setNecessity(lvl.id)}
                                                        title={lvl.description}
                                                        className={cn(
                                                            'px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                                                            active ? 'text-white' : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                                        )}
                                                        style={active ? { backgroundColor: `${lvl.color}33`, borderColor: lvl.color } : undefined}
                                                    >
                                                        {lvl.emoji} {lvl.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Fecha + fijo */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {[{ label: 'Hoy', value: today }, { label: 'Ayer', value: yesterdayOf(today) }].map(d => (
                                        <button
                                            key={d.label}
                                            type="button"
                                            onClick={() => { setDate(d.value); setShowDate(false) }}
                                            className={cn(
                                                'px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                                                date === d.value && !showDate
                                                    ? 'bg-white/15 border-white/40 text-white'
                                                    : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                            )}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                    {showDate ? (
                                        <input
                                            type="date"
                                            value={date}
                                            max={today}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="bg-black/30 border border-white/20 rounded-xl px-2 py-1 text-[11px] text-white [color-scheme:dark]"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowDate(true)}
                                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5 flex items-center gap-1"
                                        >
                                            <CalendarDays className="w-3.5 h-3.5" /> Otra fecha
                                        </button>
                                    )}

                                    {kind === 'expense' && (
                                        <button
                                            type="button"
                                            onClick={() => setRecurring(v => !v)}
                                            title="Se repite todos los meses (alquiler, internet, suscripción)"
                                            className={cn(
                                                'ml-auto px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1',
                                                recurring
                                                    ? 'bg-indigo-500/20 border-indigo-400 text-white'
                                                    : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                            )}
                                        >
                                            <Repeat className="w-3.5 h-3.5" /> Fijo mensual
                                        </button>
                                    )}
                                </div>

                                {error && (
                                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-start gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
                                    </p>
                                )}

                                <AnimatePresence>
                                    {saved && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className={cn(
                                                'text-xs rounded-xl px-3 py-2 flex items-center gap-1.5 border',
                                                overTarget
                                                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                                                    : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                                            )}
                                        >
                                            <Check className="w-3.5 h-3.5 shrink-0" />
                                            Guardado. Hoy llevás {formatCurrency(saved.todayTotal)} en {saved.todayCount} {saved.todayCount === 1 ? 'gasto' : 'gastos'}
                                            {overTarget && target ? ` (te pasaste ${formatCurrency(saved.todayTotal - target)} del tope)` : ''}.
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                {/* Acciones: siempre a la vista, aunque el formulario no entre en la pantalla */}
                                <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-[#12141c]/95 backdrop-blur border-t border-white/5 flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => save(true)}
                                        className="px-4 py-3 rounded-2xl text-xs font-bold border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 disabled:opacity-50"
                                    >
                                        Guardar y otro
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className={cn(
                                            'flex-1 py-3 rounded-2xl text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-60',
                                            kind === 'expense'
                                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                                        )}
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        {kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

/** Botón para abrir el registro rápido desde cualquier pantalla (dashboard, finanzas, cierre). */
export function QuickExpenseTrigger({
    label = 'Registrar gasto',
    todayTotal,
    kind = 'expense',
    className
}: {
    label?: string
    todayTotal?: number
    kind?: 'expense' | 'income'
    className?: string
}) {
    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-expense', { detail: { kind } }))}
            className={cn(
                'px-3 py-2 rounded-2xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap',
                className
            )}
        >
            <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{label}</span>
            {typeof todayTotal === 'number' && (
                <span className="text-[10px] font-mono text-emerald-200/80 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">
                    hoy {formatCurrency(todayTotal)}
                </span>
            )}
        </button>
    )
}
