'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Wallet, TrendingUp, TrendingDown, Landmark, Trash2, X, Loader2, Edit3, Target, Calendar } from 'lucide-react'
import { createTransaction, createDebt, deleteTransaction, deleteDebt, updateDebt, saveMonthlyBudget, createFinancialGoal, updateFinancialGoal, deleteFinancialGoal } from '@/lib/actions/finances'

export function FinancesClient({ transactions, debts, initialBudget, initialGoals, monthYear }: { transactions: any[], debts: any[], initialBudget: any, initialGoals: any[], monthYear: string }) {
    const [isTxFormOpen, setIsTxFormOpen] = useState(false)
    const [isDebtFormOpen, setIsDebtFormOpen] = useState(false)
    const [isGoalFormOpen, setIsGoalFormOpen] = useState(false)
    const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false)
    const [isDepositFormOpen, setIsDepositFormOpen] = useState(false)

    const [editingDebt, setEditingDebt] = useState<any | null>(null)
    const [prefilledDebtId, setPrefilledDebtId] = useState<string>('')
    const [selectedGoal, setSelectedGoal] = useState<any | null>(null)
    const [loading, setLoading] = useState<string | null>(null)

    // Advanced Budget States
    const [budgetIncomes, setBudgetIncomes] = useState<any[]>(initialBudget?.incomes_json || [])
    const [budgetExpenses, setBudgetExpenses] = useState<any[]>(initialBudget?.expenses_json || [])

    // Real Calculations
    const realIncome = transactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0)
    const realFixedExpenses = transactions.filter(t => t.type === 'Fixed_Expense').reduce((acc, t) => acc + t.amount, 0)
    const realVariableExpenses = transactions.filter(t => t.type === 'Variable').reduce((acc, t) => acc + t.amount, 0)
    const realDebtPayments = transactions.filter(t => t.type === 'Debt_Payment').reduce((acc, t) => acc + t.amount, 0)

    const realTotalExpenses = realFixedExpenses + realVariableExpenses + realDebtPayments
    const realBalance = realIncome - realTotalExpenses
    const totalDebt = debts.reduce((acc, d) => acc + d.remaining_amount, 0)

    // Budget Calculations
    const securedIncomes = budgetIncomes.filter(i => i.is_secured).reduce((acc, i) => acc + i.amount, 0)
    const potentialIncomes = budgetIncomes.filter(i => !i.is_secured).reduce((acc, i) => acc + i.amount, 0)
    const totalProjectedIncome = securedIncomes + potentialIncomes

    const fixedProjectedExpenses = budgetExpenses.filter(e => e.is_fixed).reduce((acc, e) => acc + e.amount, 0)
    const variableProjectedExpenses = budgetExpenses.filter(e => !e.is_fixed).reduce((acc, e) => acc + e.amount, 0)
    const totalProjectedExpenses = fixedProjectedExpenses + variableProjectedExpenses

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
    }

    // Handlers
    async function handleTxSubmit(formData: FormData) {
        setLoading('tx')
        try {
            await createTransaction(formData)
            setIsTxFormOpen(false)
        } catch (e) {
            alert('Error guardando transacción')
        } finally {
            setLoading(null)
        }
    }

    async function handleDebtSubmit(formData: FormData) {
        if (loading === 'debt') return
        setLoading('debt')
        try {
            if (editingDebt) {
                await updateDebt(editingDebt.id, formData)
            } else {
                await createDebt(formData)
            }
            setIsDebtFormOpen(false)
            setEditingDebt(null)
        } catch (e) {
            alert('Error guardando deuda')
        } finally {
            setLoading(null)
        }
    }

    async function handleDeleteDebt(id: string) {
        if (!confirm('¿Eliminar esta deuda? No se guardará el registro si hay pagos pendientes.')) return
        setLoading(id)
        try {
            await deleteDebt(id)
        } catch (e) {
            alert('Error eliminando deuda')
        } finally {
            setLoading(null)
        }
    }

    async function handleBudgetSave() {
        setLoading('budget')
        try {
            await saveMonthlyBudget(monthYear, JSON.stringify(budgetIncomes), JSON.stringify(budgetExpenses))
            setIsBudgetFormOpen(false)
        } catch (e) {
            alert('Error guardando presupuesto')
        } finally {
            setLoading(null)
        }
    }

    async function handleGoalSubmit(formData: FormData) {
        setLoading('goal')
        try {
            await createFinancialGoal(formData)
            setIsGoalFormOpen(false)
        } catch (e) {
            alert('Error creando objetivo')
        } finally {
            setLoading(null)
        }
    }

    async function handleDeleteGoal(id: string) {
        if (!confirm('¿Eliminar objetivo?')) return
        setLoading(id)
        try {
            await deleteFinancialGoal(id)
        } catch (e) {
            alert('Error eliminando objetivo')
        } finally {
            setLoading(null)
        }
    }

    async function handleDepositSubmit(formData: FormData) {
        if (!selectedGoal) return
        setLoading('deposit')
        try {
            const added = parseFloat(formData.get('added_amount') as string)
            const formDataUpdated = new FormData()
            formDataUpdated.append('current_amount', (parseFloat(selectedGoal.current_amount) + added).toString())
            await updateFinancialGoal(selectedGoal.id, formDataUpdated)
            setIsDepositFormOpen(false)
            setSelectedGoal(null)
        } catch (e) {
            alert('Error agregando fondos')
        } finally {
            setLoading(null)
        }
    }

    function openPayDebt(debt: any) {
        setPrefilledDebtId(debt.id)
        setIsTxFormOpen(true)
    }

    async function handleDeleteTx(id: string) {
        if (!confirm('¿Eliminar transacción?')) return
        setLoading(id)
        try {
            await deleteTransaction(id)
        } catch (e) {
            alert('Error eliminando')
        } finally {
            setLoading(null)
        }
    }

    // Weekly calculations for goals
    const calculateWeeklyDeposit = (goal: any) => {
        if (!goal.target_date) return null

        const remainingAmount = goal.target_amount - goal.current_amount
        if (remainingAmount <= 0) return 0

        const now = new Date()
        const target = new Date(goal.target_date)

        const diffTime = Math.abs(target.getTime() - now.getTime())
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))

        if (diffWeeks <= 0) return remainingAmount

        return remainingAmount / diffWeeks
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Finanzas
                        <Wallet className="w-6 h-6 text-emerald-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Control de presupuesto, previsiones y amortización de deudas.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsBudgetFormOpen(true)}
                        className="glass hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    >
                        Forecast Mensual
                    </button>
                    <button
                        onClick={() => setIsGoalFormOpen(true)}
                        className="glass hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    >
                        Nuevo Objetivo
                    </button>
                    <button
                        onClick={() => setIsDebtFormOpen(true)}
                        className="glass hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    >
                        Nueva Deuda
                    </button>
                    <button
                        onClick={() => setIsTxFormOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Movimiento
                    </button>
                </div>
            </div>

            {/* Budget Display Widget */}
            {initialBudget && (totalProjectedIncome > 0 || totalProjectedExpenses > 0) && (
                <div className="glass p-5 rounded-3xl border border-border/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet className="w-32 h-32 text-foreground" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                        <div>
                            <h2 className="text-lg font-heading font-semibold">Forecast</h2>
                            <p className="text-sm text-muted-foreground">{monthYear}</p>
                            <button onClick={() => setIsBudgetFormOpen(true)} className="mt-4 text-xs font-medium text-emerald-500 hover:underline">Ver Detalles →</button>
                        </div>

                        <div className="bg-secondary/30 rounded-2xl p-4">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Previsión vs Real</p>
                            <p className="text-sm font-medium">Ingresos</p>
                            <div className="flex gap-2 items-baseline mt-1">
                                <span className={`text-xl font-bold ${realIncome >= totalProjectedIncome ? 'text-emerald-500' : 'text-foreground'}`}>
                                    {formatCurrency(realIncome)}
                                </span>
                                <span className="text-xs text-muted-foreground">/ {formatCurrency(totalProjectedIncome)}</span>
                            </div>
                        </div>

                        <div className="bg-secondary/30 rounded-2xl p-4">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Previsión vs Real</p>
                            <p className="text-sm font-medium">Gastos</p>
                            <div className="flex gap-2 items-baseline mt-1">
                                <span className={`text-xl font-bold ${realTotalExpenses > totalProjectedExpenses ? 'text-red-500' : 'text-foreground'}`}>
                                    {formatCurrency(realTotalExpenses)}
                                </span>
                                <span className="text-xs text-muted-foreground">/ {formatCurrency(totalProjectedExpenses)}</span>
                            </div>
                        </div>

                        <div className="bg-secondary/30 rounded-2xl p-4">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Margen Planificado</p>
                            <p className="text-sm font-medium">Gap Esperado</p>
                            <div className="flex gap-2 items-baseline mt-1">
                                <span className={`text-xl font-bold ${(totalProjectedIncome - totalProjectedExpenses) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {formatCurrency(totalProjectedIncome - totalProjectedExpenses)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Ingresos</p>
                    <p className="text-2xl font-bold text-emerald-500">{formatCurrency(realIncome)}</p>
                </div>

                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingDown className="w-16 h-16 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Gastos (Total)</p>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(realTotalExpenses)}</p>
                </div>

                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="w-16 h-16 text-indigo-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Balance Real</p>
                    <p className={`text-2xl font-bold ${realBalance >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                        {formatCurrency(realBalance)}
                    </p>
                </div>

                <div className="glass p-5 rounded-3xl border border-red-500/20 shadow-sm relative overflow-hidden group bg-red-500/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Landmark className="w-16 h-16 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-red-400 mb-1">Deuda Viva Total</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalDebt)}</p>
                </div>
            </div>

            {/* Financial Goals Tracker */}
            {initialGoals?.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-heading font-semibold px-1">Objetivos de Ahorro</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {initialGoals.map(goal => {
                            const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                            const isCompleted = progress >= 100
                            const weeklyDeposit = calculateWeeklyDeposit(goal)

                            return (
                                <div key={goal.id} className={`glass p-5 rounded-2xl border ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50'} relative group overflow-hidden`}>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all flex gap-1 z-10">
                                        <button
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            disabled={loading === goal.id}
                                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                        >
                                            {loading === goal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-start mb-2 pr-12">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <Target className="w-4 h-4" style={{ color: goal.color_hex }} />
                                            {goal.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-end justify-between mb-4">
                                        <div>
                                            <p className="text-2xl font-bold">{formatCurrency(goal.current_amount)}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                Meta: {formatCurrency(goal.target_amount)}
                                                {goal.target_date && <span className="ml-1"><Calendar className="w-3 h-3 inline" /> {new Date(goal.target_date).toLocaleDateString()}</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {weeklyDeposit !== null && !isCompleted && (
                                        <div className="bg-secondary/50 rounded-lg p-2.5 mb-4 text-xs">
                                            <span className="text-muted-foreground block mb-1">Carga semanal sugerida:</span>
                                            <span className="font-semibold text-foreground text-sm">{formatCurrency(weeklyDeposit)} / semana</span>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Progreso</span>
                                            <span className="font-medium">{progress.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${progress}%`, backgroundColor: isCompleted ? '#10b981' : goal.color_hex }}
                                            />
                                        </div>
                                    </div>

                                    {!isCompleted && (
                                        <button
                                            onClick={() => { setSelectedGoal(goal); setIsDepositFormOpen(true) }}
                                            className="w-full mt-4 py-2 hover:bg-secondary text-foreground text-xs font-bold rounded-xl border border-border transition-all"
                                        >
                                            Sumar Fondos
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Transactions List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-heading font-semibold px-1">Movimientos del mes</h2>
                    <div className="glass rounded-2xl border border-border/50 overflow-hidden">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                No hay movimientos este mes.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${tx.type === 'Income' ? 'bg-emerald-500/10 text-emerald-500' :
                                                tx.type === 'Debt_Payment' ? 'bg-indigo-500/10 text-indigo-400' :
                                                    'bg-red-500/10 text-red-400'
                                                }`}>
                                                {tx.type === 'Income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{tx.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded-full">
                                                        {tx.category}
                                                    </span>
                                                    {tx.type === 'Debt_Payment' && tx.debts && (
                                                        <span className="text-xs text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-full flex items-center gap-1">
                                                            <Landmark className="w-3 h-3" /> {tx.debts.creditor}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-semibold ${tx.type === 'Income' ? 'text-emerald-500' : 'text-foreground'}`}>
                                                {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteTx(tx.id)}
                                                disabled={loading === tx.id}
                                                className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                                            >
                                                {loading === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Debts Tracker */}
                <div className="space-y-4">
                    <h2 className="text-xl font-heading font-semibold px-1">Deudas Activas</h2>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {debts.length === 0 ? (
                            <div className="glass p-8 text-center rounded-2xl border border-dashed border-border border-emerald-500/20">
                                <p className="text-sm text-emerald-500 font-medium">¡Libre de deudas!</p>
                            </div>
                        ) : debts.map(debt => {
                            const progress = 100 - (debt.remaining_amount / debt.total_amount * 100)
                            return (
                                <div key={debt.id} className="glass p-5 rounded-2xl border border-red-500/20 bg-card relative overflow-hidden group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all flex gap-1 z-10">
                                        <button
                                            onClick={() => { setEditingDebt(debt); setIsDebtFormOpen(true) }}
                                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDebt(debt.id)}
                                            disabled={loading === debt.id}
                                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                        >
                                            {loading === debt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-start mb-2 pr-12">
                                        <h3 className="font-semibold">{debt.creditor}</h3>
                                        <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
                                            Día {debt.due_day}
                                        </span>
                                    </div>
                                    <div className="flex items-end justify-between mb-4">
                                        <div>
                                            <p className="text-2xl font-bold text-red-500">{formatCurrency(debt.remaining_amount)}</p>
                                            <p className="text-xs text-muted-foreground">de {formatCurrency(debt.total_amount)}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Progreso de pago</span>
                                            <span>{progress.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openPayDebt(debt)}
                                        className="w-full mt-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 transition-all uppercase tracking-wider"
                                    >
                                        Registrar Pago
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Various Modals... */}

            <AnimatePresence>
                {/* Advanced Budget Modal (Drawer/Full Screen) */}
                {isBudgetFormOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBudgetFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full h-full md:max-w-6xl md:h-[95dvh] flex flex-col md:rounded-2xl border border-border shadow-2xl relative z-10">

                            <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
                                <h2 className="text-2xl font-bold font-heading flex flex-col md:flex-row md:items-center gap-2">
                                    Forecast Previsional <span className="text-muted-foreground text-sm font-medium bg-secondary px-3 py-1 rounded-full">{monthYear}</span>
                                </h2>
                                <button onClick={() => setIsBudgetFormOpen(false)} className="text-muted-foreground hover:text-foreground bg-secondary/50 p-2 rounded-full"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Editor Column */}
                                <div className="lg:col-span-8 flex flex-col gap-8">

                                    {/* Incomes Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-heading font-semibold text-emerald-500 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Ingresos Proyectados</h3>
                                            <button
                                                onClick={() => setBudgetIncomes([...budgetIncomes, { id: Date.now(), description: '', amount: 0, expected_date: '', is_secured: false }])}
                                                className="text-xs font-medium bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Añadir
                                            </button>
                                        </div>
                                        <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                                            <div className="divide-y divide-border/50">
                                                {budgetIncomes.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No has agregado ingresos.</p>}
                                                {budgetIncomes.map((inc, index) => (
                                                    <div key={inc.id} className="p-3 md:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card hover:bg-secondary/20 transition-colors">
                                                        <div className="flex-1 w-full">
                                                            <input
                                                                type="text"
                                                                placeholder="Descripción (Ej. Sueldo, Venta Cliente X...)"
                                                                value={inc.description}
                                                                onChange={(e) => {
                                                                    const nv = [...budgetIncomes]; nv[index].description = e.target.value; setBudgetIncomes(nv);
                                                                }}
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium p-0"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto shrink-0">
                                                            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
                                                                <span className="text-muted-foreground text-sm">$</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={inc.amount || ''}
                                                                    onChange={(e) => {
                                                                        const nv = [...budgetIncomes]; nv[index].amount = parseFloat(e.target.value) || 0; setBudgetIncomes(nv);
                                                                    }}
                                                                    className="w-24 bg-transparent border-none focus:ring-0 text-sm p-0 text-right"
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Día o Fecha"
                                                                value={inc.expected_date}
                                                                onChange={(e) => {
                                                                    const nv = [...budgetIncomes]; nv[index].expected_date = e.target.value; setBudgetIncomes(nv);
                                                                }}
                                                                className="w-28 bg-secondary/50 border border-border/50 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={inc.is_secured}
                                                                    onChange={(e) => {
                                                                        const nv = [...budgetIncomes]; nv[index].is_secured = e.target.checked; setBudgetIncomes(nv);
                                                                    }}
                                                                    className="rounded text-emerald-500 focus:ring-emerald-500"
                                                                />
                                                                Seguro
                                                            </label>
                                                            <button
                                                                onClick={() => setBudgetIncomes(budgetIncomes.filter(i => i.id !== inc.id))}
                                                                className="text-muted-foreground hover:text-red-400 p-1"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expenses Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-heading font-semibold text-red-400 flex items-center gap-2"><TrendingDown className="w-5 h-5" /> Gastos Proyectados</h3>
                                            <button
                                                onClick={() => setBudgetExpenses([...budgetExpenses, { id: Date.now(), description: '', amount: 0, due_date: '', is_fixed: true }])}
                                                className="text-xs font-medium bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Añadir
                                            </button>
                                        </div>
                                        <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                                            <div className="divide-y divide-border/50">
                                                {budgetExpenses.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No has agregado gastos.</p>}
                                                {budgetExpenses.map((exp, index) => (
                                                    <div key={exp.id} className="p-3 md:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card hover:bg-secondary/20 transition-colors">
                                                        <div className="flex-1 w-full">
                                                            <input
                                                                type="text"
                                                                placeholder="Descripción (Ej. Alquiler, Salida al cine...)"
                                                                value={exp.description}
                                                                onChange={(e) => {
                                                                    const nv = [...budgetExpenses]; nv[index].description = e.target.value; setBudgetExpenses(nv);
                                                                }}
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium p-0"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto shrink-0">
                                                            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
                                                                <span className="text-muted-foreground text-sm">$</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={exp.amount || ''}
                                                                    onChange={(e) => {
                                                                        const nv = [...budgetExpenses]; nv[index].amount = parseFloat(e.target.value) || 0; setBudgetExpenses(nv);
                                                                    }}
                                                                    className="w-24 bg-transparent border-none focus:ring-0 text-sm p-0 text-right"
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Vencimiento"
                                                                value={exp.due_date}
                                                                onChange={(e) => {
                                                                    const nv = [...budgetExpenses]; nv[index].due_date = e.target.value; setBudgetExpenses(nv);
                                                                }}
                                                                className="w-28 bg-secondary/50 border border-border/50 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-red-500"
                                                            />
                                                            <div className="flex border border-border/50 rounded-lg overflow-hidden shrink-0">
                                                                <button
                                                                    onClick={() => { const nv = [...budgetExpenses]; nv[index].is_fixed = true; setBudgetExpenses(nv); }}
                                                                    className={`px-2 py-1 text-[10px] font-medium transition-colors ${exp.is_fixed ? 'bg-red-500 text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                                                                >
                                                                    Fijo
                                                                </button>
                                                                <button
                                                                    onClick={() => { const nv = [...budgetExpenses]; nv[index].is_fixed = false; setBudgetExpenses(nv); }}
                                                                    className={`px-2 py-1 text-[10px] font-medium transition-colors ${!exp.is_fixed ? 'bg-orange-500 text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                                                                >
                                                                    Variable
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => setBudgetExpenses(budgetExpenses.filter(i => i.id !== exp.id))}
                                                                className="text-muted-foreground hover:text-red-400 p-1 ml-1"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* Dashboard Column */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="glass p-6 rounded-2xl border border-border shadow-lg sticky top-0">
                                        <h3 className="font-heading font-semibold text-lg border-b border-border/50 pb-4 mb-4">Resumen de Previsión</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-sm font-medium text-emerald-500">Ingresos Ajustados</span>
                                                    <span className="font-bold text-lg">{formatCurrency(securedIncomes)}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex justify-between">
                                                    <span>(+ Potencial: {formatCurrency(potentialIncomes)})</span>
                                                    <span>Total: {formatCurrency(totalProjectedIncome)}</span>
                                                </p>
                                            </div>

                                            <div className="border-t border-border/50 pt-4">
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-sm font-medium text-red-500">Gastos Base (Fijos)</span>
                                                    <span className="font-bold text-lg">{formatCurrency(fixedProjectedExpenses)}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex justify-between">
                                                    <span>(+ Variables: {formatCurrency(variableProjectedExpenses)})</span>
                                                    <span>Total: {formatCurrency(totalProjectedExpenses)}</span>
                                                </p>
                                            </div>

                                            <div className="border-t border-border/50 pt-4 mt-2">
                                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">Balances</p>

                                                <div className="bg-secondary/30 rounded-xl p-3 mb-2 flex justify-between items-center">
                                                    <span className="text-sm">Margen Seguro (Ing.Seguro - Gastos)</span>
                                                    <span className={`font-bold ${(securedIncomes - totalProjectedExpenses) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {formatCurrency(securedIncomes - totalProjectedExpenses)}
                                                    </span>
                                                </div>

                                                <div className="glass bg-card/50 rounded-xl p-3 flex justify-between items-center border border-border/50">
                                                    <span className="text-sm font-medium">Margen Potencial Total</span>
                                                    <span className={`font-bold ${(totalProjectedIncome - totalProjectedExpenses) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {formatCurrency(totalProjectedIncome - totalProjectedExpenses)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleBudgetSave}
                                            disabled={loading === 'budget'}
                                            className="w-full mt-6 bg-foreground text-background hover:bg-foreground/90 font-medium rounded-xl py-3 shadow flex items-center justify-center transition-all"
                                        >
                                            {loading === 'budget' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Forecast Mensual'}
                                        </button>
                                        {(totalProjectedIncome - totalProjectedExpenses) < 0 && (
                                            <p className="text-xs text-red-400 mt-4 text-center">
                                                Tu forecast da números rojos. Evaluá aumentar tus ingresos potenciales o recortar gastos variables.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    </div>
                )}


                {/* Transaction Modal */}
                {isTxFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTxFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Movimiento Real</h2>
                                <button onClick={() => { setIsTxFormOpen(false); setPrefilledDebtId('') }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleTxSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Tipo</label>
                                        <select name="type" defaultValue={prefilledDebtId ? 'Debt_Payment' : 'Variable'} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 appearance-none">
                                            <option value="Variable">Gasto Variable</option>
                                            <option value="Fixed_Expense">Gasto Fijo</option>
                                            <option value="Income">Ingreso</option>
                                            <option value="Debt_Payment">Pago de Deuda</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Categoría</label>
                                        <select name="category" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 appearance-none">
                                            <option value="General">General</option>
                                            <option value="Housing">Vivienda</option>
                                            <option value="Food">Comida</option>
                                            <option value="Transport">Transporte</option>
                                            <option value="Entertainment">Ocio</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Descripción</label>
                                    <input required name="description" placeholder="Ej. Supermercado" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Monto ($)</label>
                                    <input required type="number" step="0.01" name="amount" placeholder="0.00" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>

                                {debts.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Si es pago de deuda, seleccioná cuál:</label>
                                        <select name="debt_id" defaultValue={prefilledDebtId} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none">
                                            <option value="">-- No es deuda --</option>
                                            {debts.map(d => <option key={d.id} value={d.id}>{d.creditor}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => { setIsTxFormOpen(false); setPrefilledDebtId('') }} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'tx'} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'tx' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Debt Modal */}
                {isDebtFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDebtFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">{editingDebt ? 'Editar Deuda' : 'Nueva Deuda'}</h2>
                                <button onClick={() => { setIsDebtFormOpen(false); setEditingDebt(null) }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleDebtSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Acreedor / Nombre</label>
                                    <input required name="creditor" defaultValue={editingDebt?.creditor} placeholder="Ej. Tarjeta de Crédito, Préstamo Auto..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Monto Total ($)</label>
                                        <input required type="number" step="0.01" name="total_amount" defaultValue={editingDebt?.total_amount} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Restante ($)</label>
                                        <input required type="number" step="0.01" name="remaining_amount" defaultValue={editingDebt?.remaining_amount} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Día de vencimiento</label>
                                        <input required type="number" min="1" max="31" name="due_day" defaultValue={editingDebt?.due_day} placeholder="1-31" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                    </div>
                                </div>
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => { setIsDebtFormOpen(false); setEditingDebt(null) }} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'debt'} type="submit" className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'debt' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Financial Goal Modal */}
                {isGoalFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGoalFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Objetivo Financiero</h2>
                                <button onClick={() => setIsGoalFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleGoalSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Título (Ej. Vacaciones, Ahorro Emergencia...)</label>
                                    <input required name="title" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Monto Objetivo ($)</label>
                                        <input required type="number" step="0.01" name="target_amount" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Color</label>
                                        <input type="color" name="color_hex" defaultValue="#10b981" className="w-full h-[46px] bg-secondary border border-border rounded-xl p-1 cursor-pointer" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Fecha Límite (Opcional)</label>
                                    <input type="date" name="target_date" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsGoalFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'goal'} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'goal' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Deposit Funds Modal */}
                {isDepositFormOpen && selectedGoal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsDepositFormOpen(false); setSelectedGoal(null) }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-sm max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Separar Fondos</h2>
                                <button onClick={() => { setIsDepositFormOpen(false); setSelectedGoal(null) }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleDepositSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <p className="text-sm text-muted-foreground mb-4">Añadí fondos a: <strong className="text-foreground">{selectedGoal.title}</strong></p>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Monto a sumar ($)</label>
                                    <input required type="number" step="0.01" name="added_amount" autoFocus placeholder="Ej. 5000" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => { setIsDepositFormOpen(false); setSelectedGoal(null) }} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'deposit'} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'deposit' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sumar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
