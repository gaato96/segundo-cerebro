'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Delete, Loader2, Plus, Trash2, Search } from 'lucide-react'
import type { BudgetEnvelopeItem } from '@/lib/actions/budget_envelopes'
import type { DebtsOverview } from '@/lib/actions/debts'
import type { MonthForecast } from '@/lib/actions/forecast'
import { createQuickEntry } from '@/lib/actions/expenses'
import { EXPENSE_CATEGORIES, defaultNecessity, getPaymentMethod } from '@/lib/expenseCategories'
import { Panel, SectionLabel } from '@/components/ui/kit'
import { Bar, Segmented } from '@/components/ui/controls'
import { formatCurrency, cn } from '@/lib/utils'

const TYPE: Record<string, string> = { Income: 'Ingreso', Fixed_Expense: 'Fijo', Variable: 'Variable', Debt_Payment: 'Deuda' }

/** Resumen del mes: cuánto queda, sobres, movimientos y carga inmediata. */
export function FinanceSummary({ transactions, envelopes, debts, forecast, today, onAddEnvelope, onDeleteEnvelope, onDeleteTx, onGoDebts }: {
    transactions: any[]; envelopes: BudgetEnvelopeItem[]; debts: DebtsOverview; forecast: MonthForecast | null; today: string
    onAddEnvelope: () => void; onDeleteEnvelope: (id: string) => void; onDeleteTx: (id: string) => void; onGoDebts: () => void
}) {
    const [filter, setFilter] = useState<'all' | 'out' | 'in' | 'fixed'>('all')
    const [q, setQ] = useState('')
    const [limit, setLimit] = useState(8)

    const sum = (t: string) => transactions.filter(x => x.type === t).reduce((n, x) => n + Number(x.amount), 0)
    const income = sum('Income')
    const spent = sum('Fixed_Expense') + sum('Variable') + sum('Debt_Payment')
    const left = income - spent
    const [y, m, d] = today.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const usedPct = income > 0 ? (spent / income) * 100 : 0
    const timePct = (d / days) * 100
    // Lo gastado por sobre sale de los movimientos reales de esa categoría.
    const spentIn = (e: BudgetEnvelopeItem) => {
        const real = transactions.filter(t => t.type !== 'Income' && String(t.category || '').toLowerCase() === e.category.toLowerCase()).reduce((n, t) => n + Number(t.amount), 0)
        return Math.max(real, Number(e.spent_amount || 0))
    }
    const list = transactions
        .filter(t => filter === 'all' || (filter === 'in' ? t.type === 'Income' : filter === 'fixed' ? t.type === 'Fixed_Expense' : t.type !== 'Income'))
        .filter(t => !q || `${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
    const open = debts.debts.filter(x => x.remaining_amount > 0)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl bg-card border border-hairline lg:divide-x divide-hairline">
                <div className="lg:col-span-8 p-5 md:p-6">
                    <div className="flex items-center justify-between"><p className="label-caps">Disponible del mes</p><span className="font-mono text-xs text-muted-foreground">{days - d} días restantes</span></div>
                    <p className={cn('font-mono text-4xl md:text-5xl font-medium mt-2 tracking-tight', left < 0 && 'text-red-300')}>{formatCurrency(left)}</p>
                    <div className="mt-5 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>Consumido <span className="font-mono text-foreground">{income > 0 ? `${Math.round(usedPct)}%` : 'sin ingresos cargados'}</span></span><span>Mes <span className="font-mono text-foreground">{Math.round(timePct)}%</span></span></div>
                        <Bar pct={usedPct} tone={usedPct > 100 ? 'bad' : usedPct > timePct + 10 ? 'amber' : 'good'} /><Bar pct={timePct} />
                    </div>
                    {forecast && <p className="text-sm text-muted-foreground mt-4">{forecast.headline} <span className="font-mono text-foreground">{formatCurrency(forecast.projectedEndBalance)}</span> proyectado al cierre.</p>}
                </div>
                <dl className="lg:col-span-4 p-5 md:p-6 border-t lg:border-t-0 border-hairline text-sm">
                    <p className="label-caps mb-2">Flujo del mes</p>
                    {([['Ingresos', income, 'text-emerald-300'], ['Gastos', spent, ''], ['Deudas vivas', debts.totals.remaining, debts.totals.remaining > 0 ? 'text-red-300' : '']] as [string, number, string][]).map(([l, v, c]) => <div key={l} className="flex justify-between py-2.5 border-b border-hairline last:border-0"><dt className="text-muted-foreground">{l}</dt><dd className={cn('font-mono', c)}>{formatCurrency(v)}</dd></div>)}
                    {income > 0 && <div className="flex justify-between pt-2.5 border-t border-hairline"><dt className="text-muted-foreground">Ahorro</dt><dd className="font-mono">{Math.round((left / income) * 100)}%</dd></div>}
                </dl>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 min-w-0 space-y-6">
                    <Panel>
                        <SectionLabel right={<button onClick={onAddEnvelope} className="inline-flex items-center gap-1 hover:text-foreground min-h-[32px]"><Plus className="w-3.5 h-3.5" /> Sobre</button>}>Sobres</SectionLabel>
                        {envelopes.length === 0 ? <p className="text-sm text-muted-foreground">Asigná un tope por categoría y mirá cuánto te queda en cada una. Usá el mismo nombre que la categoría del gasto.</p> : (
                            <div className="space-y-4">{envelopes.map(e => {
                                const s = spentIn(e), rest = e.allocated_amount - s, pct = e.allocated_amount > 0 ? (s / e.allocated_amount) * 100 : 0
                                return <div key={e.id} className="group"><div className="flex flex-wrap items-center gap-x-3 text-sm mb-1.5"><span className="flex-1 min-w-0 truncate">{e.category} <span className="font-mono text-xs text-muted-foreground">{Math.round(pct)}%</span></span><span className={cn('text-xs', rest < 0 ? 'text-red-300' : 'text-muted-foreground')}>{rest < 0 ? `te pasaste ${formatCurrency(-rest)}` : `quedan ${formatCurrency(rest)}`}</span><span className="font-mono text-xs">{formatCurrency(s)} / {formatCurrency(e.allocated_amount)}</span><button onClick={() => onDeleteEnvelope(e.id)} aria-label={`Eliminar sobre ${e.category}`} className="text-ink-faint hover:text-red-300 p-1"><Trash2 className="w-3.5 h-3.5" /></button></div><Bar pct={pct} tone={rest < 0 ? 'bad' : pct > 80 ? 'amber' : 'neutral'} /></div>
                            })}</div>
                        )}
                    </Panel>

                    <section>
                        <div className="flex flex-wrap items-center gap-2 mb-3"><h2 className="label-caps mr-auto">Movimientos</h2>
                            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar movimiento" className="field !w-40 pl-9" /></div>
                            <Segmented value={filter} onChange={setFilter} options={[{ id: 'all', label: 'Todos', count: transactions.length }, { id: 'out', label: 'Gastos' }, { id: 'in', label: 'Ingresos' }, { id: 'fixed', label: 'Fijos' }]} /></div>
                        <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                            {list.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Sin movimientos.</p>}
                            {list.slice(0, limit).map(t => {
                                const date = String(t.occurred_on || t.created_at).slice(0, 10)
                                return <div key={t.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px]"><span className="font-mono text-xs text-muted-foreground w-11 shrink-0">{date.slice(8)}/{date.slice(5, 7)}</span><div className="flex-1 min-w-0"><p className="text-sm truncate">{t.description}</p><p className="text-xs text-muted-foreground truncate">{t.category || TYPE[t.type]}{getPaymentMethod(t.payment_method) ? ` · ${getPaymentMethod(t.payment_method)!.label}` : ''}</p></div><span className={cn('font-mono text-sm whitespace-nowrap', t.type === 'Income' ? 'text-emerald-300' : 'text-foreground')}>{t.type === 'Income' ? '+' : '−'}{formatCurrency(Number(t.amount))}</span><button onClick={() => onDeleteTx(t.id)} aria-label="Eliminar movimiento" className="w-9 h-9 -mr-2 text-ink-faint hover:text-red-300 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button></div>
                            })}
                            {list.length > limit && <button onClick={() => setLimit(l => l + 20)} className="w-full h-12 text-xs text-muted-foreground hover:text-foreground">Ver {list.length - limit} más</button>}
                        </div>
                    </section>
                </div>

                <aside className="lg:col-span-4 min-w-0 space-y-4">
                    <Keypad />
                    <Panel>
                        <SectionLabel right={<button onClick={onGoDebts} className="hover:text-foreground min-h-[32px]">ver estrategia</button>}>Deudas</SectionLabel>
                        {open.length === 0 ? <p className="text-sm text-muted-foreground">Sin deudas pendientes.</p> : <div className="divide-y divide-hairline">{open.slice(0, 4).map(x => {
                            const paid = x.total_amount > 0 ? (1 - x.remaining_amount / x.total_amount) * 100 : 0
                            return <div key={x.id} className="py-3 first:pt-0"><div className="flex justify-between gap-3 text-sm"><span className="truncate">{x.creditor}</span><span className="font-mono">{formatCurrency(x.remaining_amount)}</span></div><Bar pct={paid} className="my-2" /><p className="text-xs text-muted-foreground">{x.plan_active && x.plan_installments ? `cuota ${x.plan_installments_paid}/${x.plan_installments} · ${formatCurrency(x.plan_installment_amount || 0)}` : x.due_day ? `vence el ${x.due_day}` : 'sin plan de pago'}</p></div>
                        })}</div>}
                    </Panel>
                </aside>
            </div>
        </div>
    )
}

function Keypad() {
    const router = useRouter()
    const [raw, setRaw] = useState('')
    const [category, setCategory] = useState('')
    const [desc, setDesc] = useState('')
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const amount = Number(raw || 0)
    async function save() {
        if (!amount || !category) return
        setSaving(true)
        setMsg('')
        const res = await createQuickEntry({ kind: 'expense', amount, category, description: desc, necessity: defaultNecessity(category) } as any)
        setSaving(false)
        if (!res.ok) return setMsg(res.error)
        setMsg(`Guardado: ${formatCurrency(amount)} en ${category}`)
        setRaw('')
        setDesc('')
        router.refresh()
    }
    return (
        <Panel lamp>
            <SectionLabel>Gasto inmediato</SectionLabel>
            <p className="font-mono text-3xl text-right py-2 min-h-[52px]" aria-live="polite">{formatCurrency(amount)}</p>
            <div className="grid grid-cols-3 gap-1.5 hidden sm:grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map(k => <button key={k} onClick={() => setRaw(r => (r + k).replace(/^0+/, '').slice(0, 10))} className="h-11 rounded-xl bg-background/40 hover:bg-background/70 font-mono">{k}</button>)}
                <button onClick={() => setRaw(r => r.slice(0, -1))} aria-label="Borrar" className="h-11 rounded-xl bg-background/40 hover:bg-background/70 flex items-center justify-center"><Delete className="w-4 h-4" /></button>
            </div>
            <input type="number" inputMode="numeric" value={raw} onChange={e => setRaw(e.target.value)} placeholder="Monto" aria-label="Monto" className="field sm:hidden font-mono" />
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoría" className="field mt-3"><option value="">¿En qué?</option>{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}</select>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detalle (opcional)" aria-label="Detalle" className="field mt-2" />
            <button onClick={save} disabled={saving || !amount || !category} className="btn-primary w-full text-sm mt-3">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar gasto</button>
            {msg && <p role="status" className="text-xs text-muted-foreground mt-2">{msg}</p>}
        </Panel>
    )
}
