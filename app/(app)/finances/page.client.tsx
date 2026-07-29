'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Wallet, TrendingUp, TrendingDown, Landmark, Plus, Trash2, X, Target, PieChart } from 'lucide-react'
import { FinancesChart } from '@/components/finances/FinancesChart'
import { BudgetEnvelopes } from '@/components/finances/BudgetEnvelopes'
import { BudgetEnvelopeItem, createEnvelope, deleteEnvelope } from '@/lib/actions/budget_envelopes'
import { createTransaction, createDebt, deleteDebt, deleteTransaction } from '@/lib/actions/finances'
import { formatCurrency } from '@/lib/utils'

interface FinancesClientProps {
    transactions: any[]
    debts: any[]
    initialBudget: any
    initialGoals: any[]
    envelopes: BudgetEnvelopeItem[]
    monthYear: string
}

export function FinancesClient({
    transactions: initialTransactions,
    debts: initialDebts,
    initialGoals,
    envelopes: initialEnvelopes,
    monthYear
}: FinancesClientProps) {
    const [transactions, setTransactions] = useState<any[]>(initialTransactions || [])
    const [debts, setDebts] = useState<any[]>(initialDebts || [])
    const [envelopes, setEnvelopes] = useState<BudgetEnvelopeItem[]>(initialEnvelopes || [])
    const [activeTab, setActiveTab] = useState<'overview' | 'envelopes' | 'transactions' | 'debts'>('overview')

    // Modals
    const [isTxModalOpen, setIsTxModalOpen] = useState(false)
    const [isEnvelopeModalOpen, setIsEnvelopeModalOpen] = useState(false)

    // Form states
    const [txType, setTxType] = useState<'Income' | 'Fixed_Expense' | 'Variable' | 'Debt_Payment'>('Variable')
    const [txDesc, setTxDesc] = useState('')
    const [txAmount, setTxAmount] = useState('')

    const [envCategory, setEnvCategory] = useState('')
    const [envAllocated, setEnvAllocated] = useState('')
    const [envColor, setEnvColor] = useState('#6366f1')

    // Financial calculations
    const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0)
    const fixedExpenses = transactions.filter(t => t.type === 'Fixed_Expense').reduce((sum, t) => sum + t.amount, 0)
    const variableExpenses = transactions.filter(t => t.type === 'Variable').reduce((sum, t) => sum + t.amount, 0)
    const debtPayments = transactions.filter(t => t.type === 'Debt_Payment').reduce((sum, t) => sum + t.amount, 0)
    const totalExpenses = fixedExpenses + variableExpenses + debtPayments
    const netBalance = income - totalExpenses

    async function handleCreateTx(e: React.FormEvent) {
        e.preventDefault()
        if (!txDesc.trim() || !txAmount) return

        const formData = new FormData()
        formData.append('type', txType)
        formData.append('description', txDesc)
        formData.append('amount', txAmount)
        formData.append('month_year', monthYear)

        await createTransaction(formData)
        setIsTxModalOpen(false)
        window.location.reload()
    }

    async function handleCreateEnvelope(e: React.FormEvent) {
        e.preventDefault()
        if (!envCategory.trim() || !envAllocated) return

        const formData = new FormData()
        formData.append('month_year', monthYear)
        formData.append('category', envCategory)
        formData.append('allocated_amount', envAllocated)
        formData.append('color_hex', envColor)

        await createEnvelope(formData)
        setIsEnvelopeModalOpen(false)
        window.location.reload()
    }

    async function handleDeleteTx(id: string) {
        if (!confirm('¿Eliminar esta transacción?')) return
        await deleteTransaction(id)
        setTransactions(prev => prev.filter(t => t.id !== id))
    }

    async function handleDeleteEnv(id: string) {
        if (!confirm('¿Eliminar este sobre de presupuesto?')) return
        await deleteEnvelope(id)
        setEnvelopes(prev => prev.filter(e => e.id !== id))
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Finanzas & Presupuestos
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Planificación financiera en ARS, presupuestos por categoría y control de deudas.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEnvelopeModalOpen(true)}
                        className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                        <Wallet className="w-4 h-4" /> Nuevo Sobre
                    </button>
                    <button
                        onClick={() => setIsTxModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Registrar Movimiento
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-emerald-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ingresos del Mes</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(income)}</h3>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Total ingresos ARS
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-red-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Gastos Totales</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{formatCurrency(totalExpenses)}</h3>
                    <p className="text-[10px] text-red-400 mt-1 font-semibold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Fijos + Variables + Deudas
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-indigo-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Margen Libre / Ahorro</p>
                    <h3 className={`text-2xl font-bold font-heading ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(netBalance)}
                    </h3>
                    <p className="text-[10px] text-indigo-300 mt-1 font-semibold">
                        {income > 0 ? `${((netBalance / income) * 100).toFixed(0)}% del ingreso libre` : 'Sin ingresos'}
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-purple-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sobres de Presupuesto</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{envelopes.length}</h3>
                    <p className="text-[10px] text-purple-400 mt-1 font-semibold">Categorías activas</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="glass p-2 rounded-2xl border border-border/50 flex items-center gap-2 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Overview', icon: PieChart },
                    { id: 'envelopes', label: 'Sobres de Presupuesto', icon: Wallet },
                    { id: 'transactions', label: 'Transacciones', icon: DollarSign },
                    { id: 'debts', label: 'Deudas', icon: Landmark },
                ].map((tab: any) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
                <FinancesChart
                    income={income}
                    fixedExpenses={fixedExpenses}
                    variableExpenses={variableExpenses}
                    debtPayments={debtPayments}
                />
            )}

            {activeTab === 'envelopes' && (
                <BudgetEnvelopes
                    envelopes={envelopes}
                    totalIncome={income}
                    onAddEnvelope={() => setIsEnvelopeModalOpen(true)}
                    onDeleteEnvelope={handleDeleteEnv}
                />
            )}

            {activeTab === 'transactions' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-heading font-bold text-lg text-white">Lista de Transacciones ({monthYear})</h3>
                        <button onClick={() => setIsTxModalOpen(true)} className="text-xs text-indigo-400 font-semibold">+ Nueva</button>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="glass p-8 text-center rounded-3xl text-xs text-muted-foreground">
                            No hay transacciones registradas este mes.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map((t) => (
                                <div key={t.id} className="glass p-3.5 rounded-2xl border border-border/50 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">{t.description}</h4>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.type}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono font-bold text-sm ${t.type === 'Income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {t.type === 'Income' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </span>
                                        <button onClick={() => handleDeleteTx(t.id)} className="text-muted-foreground hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'debts' && (
                <div className="space-y-4">
                    <h3 className="font-heading font-bold text-lg text-white">Deudas & Tarjetas</h3>
                    {debts.length === 0 ? (
                        <div className="glass p-6 text-center rounded-2xl text-xs text-muted-foreground">
                            No tenés deudas registradas. ¡Felicitaciones!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {debts.map((d) => (
                                <div key={d.id} className="glass p-5 rounded-2xl border border-indigo-500/20 space-y-2">
                                    <h4 className="font-bold text-white text-base">{d.creditor}</h4>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Total: {formatCurrency(d.total_amount)}</span>
                                        <span className="text-red-400 font-bold">Resta: {formatCurrency(d.remaining_amount)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal Create Transaction */}
            <AnimatePresence>
                {isTxModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsTxModalOpen(false)} />
                        <div className="glass border border-border/50 w-full max-w-md rounded-3xl p-6 relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">Registrar Movimiento</h3>
                                <button onClick={() => setIsTxModalOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleCreateTx} className="space-y-3 text-xs">
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Tipo</label>
                                    <select value={txType} onChange={(e: any) => setTxType(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                        <option value="Income">🟢 Ingreso</option>
                                        <option value="Fixed_Expense">🔴 Gasto Fijo</option>
                                        <option value="Variable">🟠 Gasto Variable</option>
                                        <option value="Debt_Payment">🔵 Pago de Deuda</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Descripción *</label>
                                    <input required type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Ej: Sueldo, Supermercado..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Monto (ARS) *</label>
                                    <input required type="number" step="1" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="Ej: 50000" className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsTxModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-xl text-muted-foreground">Cancelar</button>
                                    <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Create Envelope */}
            <AnimatePresence>
                {isEnvelopeModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEnvelopeModalOpen(false)} />
                        <div className="glass border border-border/50 w-full max-w-md rounded-3xl p-6 relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">Nuevo Sobre de Presupuesto</h3>
                                <button onClick={() => setIsEnvelopeModalOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleCreateEnvelope} className="space-y-3 text-xs">
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Categoría / Nombre *</label>
                                    <input required type="text" value={envCategory} onChange={e => setEnvCategory(e.target.value)} placeholder="Ej: Alimentación, Salidas, Ahorro..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Monto Asignado (ARS) *</label>
                                    <input required type="number" step="1" value={envAllocated} onChange={e => setEnvAllocated(e.target.value)} placeholder="Ej: 100000" className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Color</label>
                                    <div className="flex items-center gap-2">
                                        {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setEnvColor(c)}
                                                className={`w-7 h-7 rounded-full border-2 ${envColor === c ? 'scale-110 border-white' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsEnvelopeModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-xl text-muted-foreground">Cancelar</button>
                                    <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Crear Sobre</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
