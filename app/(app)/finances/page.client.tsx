'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { FinanceSummary } from '@/components/finances/FinanceSummary'
import { FinancesChart } from '@/components/finances/FinancesChart'
import { BudgetProjections } from '@/components/finances/BudgetProjections'
import { DebtManager } from '@/components/finances/DebtManager'
import { DebtStrategyPanel } from '@/components/finances/DebtStrategy'
import { IncomeSources } from '@/components/finances/IncomeSources'
import { DailySpending } from '@/components/finances/DailySpending'
import { MoneyPlan } from '@/components/finances/MoneyPlan'
import { type BudgetEnvelopeItem, createEnvelope, deleteEnvelope } from '@/lib/actions/budget_envelopes'
import type { BudgetProjectionItem } from '@/lib/actions/budget_projections'
import { createTransaction, deleteTransaction } from '@/lib/actions/finances'
import type { DebtsOverview } from '@/lib/actions/debts'
import type { IncomeSourceItem } from '@/lib/actions/income_sources'
import type { MonthForecast } from '@/lib/actions/forecast'
import type { ExpenseRecord } from '@/lib/spendingMath'
import type { MoneyPlanRow, PlanContext } from '@/lib/actions/expenses'
import { EXPENSE_CATEGORIES } from '@/lib/expenseCategories'
import { PageShell, PageHeader } from '@/components/ui/kit'
import { Modal, Field, Segmented } from '@/components/ui/controls'

type Tab = 'resumen' | 'gastos' | 'plan' | 'debts' | 'income' | 'projections'

interface Props {
    transactions: any[]; initialBudget: any; initialGoals: any[]; envelopes: BudgetEnvelopeItem[]; projections: BudgetProjectionItem[]; monthYear: string
    debtsOverview: DebtsOverview; incomeSources: IncomeSourceItem[]; incomeRange: { floor: number; ceiling: number; sources: number }
    upcomingIncome: { date: string; name: string; amount: number; confidence: string; kind: string }[]; allocations: any[]
    expenseRecords: ExpenseRecord[]; moneyPlan: MoneyPlanRow | null; planContext: PlanContext | null; today: string; forecast: MonthForecast | null
}

export function FinancesClient(p: Props) {
    const router = useRouter()
    const [transactions, setTransactions] = useState(p.transactions)
    const [envelopes, setEnvelopes] = useState(p.envelopes)
    const [tab, setTab] = useState<Tab>('resumen')
    const [debtView, setDebtView] = useState<'list' | 'plan'>('list')
    const [modal, setModal] = useState<'tx' | 'envelope' | null>(null)
    const [saving, setSaving] = useState(false)
    const [tx, setTx] = useState({ type: 'Variable', description: '', amount: '' })
    const [env, setEnv] = useState({ category: '', allocated_amount: '' })
    useEffect(() => { setTransactions(p.transactions); setEnvelopes(p.envelopes) }, [p.transactions, p.envelopes])

    const total = (t: string) => transactions.filter(x => x.type === t).reduce((n, x) => n + Number(x.amount), 0)
    const [y, m, d] = p.today.split('-').map(Number)
    const month = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))

    async function submit(e: React.FormEvent, kind: 'tx' | 'envelope') {
        e.preventDefault()
        setSaving(true)
        const fd = new FormData()
        Object.entries(kind === 'tx' ? tx : { ...env, color_hex: '#7C9CBF' }).forEach(([k, v]) => fd.append(k, v))
        fd.append('month_year', p.monthYear)
        try {
            const res: any = kind === 'tx' ? await createTransaction(fd) : await createEnvelope(fd)
            if (res?.error) return alert(res.error)
            setModal(null)
            setTx({ type: 'Variable', description: '', amount: '' })
            setEnv({ category: '', allocated_amount: '' })
            router.refresh()
        } catch { alert('No se pudo guardar.') } finally { setSaving(false) }
    }
    async function removeTx(id: string) {
        if (!confirm('¿Eliminar este movimiento?')) return
        try { await deleteTransaction(id); setTransactions(t => t.filter(x => x.id !== id)) } catch { alert('No se pudo eliminar.') }
    }
    async function removeEnv(id: string) {
        if (!confirm('¿Eliminar este sobre?')) return
        const res: any = await deleteEnvelope(id)
        if (res?.error) return alert(res.error)
        setEnvelopes(x => x.filter(e => e.id !== id))
    }

    return (
        <PageShell wide>
            <PageHeader label={`${month} · día ${d}`} title="Finanzas" subtitle="Claridad sobre tus números: lo que queda, dónde se va y qué debés."
                actions={<><button onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-expense', { detail: { kind: 'income' } }))} className="btn-secondary text-sm">Ingreso</button><button onClick={() => setModal('tx')} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Movimiento</button></>} />
            <Segmented className="mb-6" value={tab} onChange={setTab} options={[{ id: 'resumen', label: 'Resumen' }, { id: 'gastos', label: 'Gasto diario' }, { id: 'plan', label: 'Reparto e inversión' }, { id: 'debts', label: 'Deudas' }, { id: 'income', label: 'Ingresos' }, { id: 'projections', label: 'Proyección' }]} />

            {tab === 'resumen' && <FinanceSummary transactions={transactions} envelopes={envelopes} debts={p.debtsOverview} forecast={p.forecast} today={p.today} onAddEnvelope={() => setModal('envelope')} onDeleteEnvelope={removeEnv} onDeleteTx={removeTx} onGoDebts={() => { setTab('debts'); setDebtView('plan') }} />}
            {tab === 'gastos' && <DailySpending records={p.expenseRecords} plan={p.moneyPlan} today={p.today} />}
            {tab === 'plan' && <MoneyPlan plan={p.moneyPlan} context={p.planContext} records={p.expenseRecords} today={p.today} />}
            {tab === 'debts' && <div className="space-y-5"><Segmented value={debtView} onChange={setDebtView} options={[{ id: 'list', label: 'Mis deudas' }, { id: 'plan', label: 'Estrategia' }]} />{debtView === 'list' ? <DebtManager overview={p.debtsOverview} /> : <DebtStrategyPanel overview={p.debtsOverview} incomeRange={p.incomeRange} upcoming={p.upcomingIncome} monthlyExpenses={total('Fixed_Expense') + total('Variable')} allocations={p.allocations} />}</div>}
            {tab === 'income' && <IncomeSources sources={p.incomeSources} range={p.incomeRange} />}
            {tab === 'projections' && <div className="space-y-6"><FinancesChart income={total('Income')} fixedExpenses={total('Fixed_Expense')} variableExpenses={total('Variable')} debtPayments={total('Debt_Payment')} /><BudgetProjections projections={p.projections} monthYear={p.monthYear} /></div>}

            <Modal open={modal === 'tx'} title="Registrar movimiento" onClose={() => setModal(null)}>
                <form onSubmit={e => submit(e, 'tx')} className="space-y-4">
                    <Field label="Tipo"><select value={tx.type} onChange={e => setTx({ ...tx, type: e.target.value })} className="field"><option value="Variable">Gasto variable</option><option value="Fixed_Expense">Gasto fijo</option><option value="Debt_Payment">Pago de deuda</option><option value="Income">Ingreso</option></select></Field>
                    <Field label="Descripción"><input required value={tx.description} onChange={e => setTx({ ...tx, description: e.target.value })} className="field" /></Field>
                    <Field label="Monto"><input required type="number" min="0" step="0.01" value={tx.amount} onChange={e => setTx({ ...tx, amount: e.target.value })} className="field font-mono" /></Field>
                    <button disabled={saving} className="btn-primary w-full text-sm">Guardar movimiento</button>
                </form>
            </Modal>
            <Modal open={modal === 'envelope'} title="Nuevo sobre" hint="Con el nombre de una categoría, el gasto se descuenta solo." onClose={() => setModal(null)}>
                <form onSubmit={e => submit(e, 'envelope')} className="space-y-4">
                    <Field label="Categoría"><input required list="env-cats" value={env.category} onChange={e => setEnv({ ...env, category: e.target.value })} className="field" /><datalist id="env-cats">{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id} />)}</datalist></Field>
                    <Field label="Tope del mes"><input required type="number" min="0" value={env.allocated_amount} onChange={e => setEnv({ ...env, allocated_amount: e.target.value })} className="field font-mono" /></Field>
                    <button disabled={saving} className="btn-primary w-full text-sm">Crear sobre</button>
                </form>
            </Modal>
        </PageShell>
    )
}
