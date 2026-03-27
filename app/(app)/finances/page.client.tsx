'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Wallet, TrendingUp, TrendingDown, Landmark, Trash2, X, Loader2 } from 'lucide-react'
import { createTransaction, createDebt, deleteTransaction } from '@/lib/actions/finances'

export function FinancesClient({ transactions, debts }: { transactions: any[], debts: any[] }) {
    const [isTxFormOpen, setIsTxFormOpen] = useState(false)
    const [isDebtFormOpen, setIsDebtFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    // Calculations
    const income = transactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0)
    const fixedExpenses = transactions.filter(t => t.type === 'Fixed_Expense').reduce((acc, t) => acc + t.amount, 0)
    const variableExpenses = transactions.filter(t => t.type === 'Variable').reduce((acc, t) => acc + t.amount, 0)
    const debtPayments = transactions.filter(t => t.type === 'Debt_Payment').reduce((acc, t) => acc + t.amount, 0)

    const totalExpenses = fixedExpenses + variableExpenses + debtPayments
    const balance = income - totalExpenses

    const totalDebt = debts.reduce((acc, d) => acc + d.remaining_amount, 0)

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
        setLoading('debt')
        try {
            await createDebt(formData)
            setIsDebtFormOpen(false)
        } catch (e) {
            alert('Error guardando deuda')
        } finally {
            setLoading(null)
        }
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
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
                        Control de presupuesto mensual y amortización de deudas.
                    </p>
                </div>
                <div className="flex gap-2">
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Ingresos</p>
                    <p className="text-2xl font-bold text-emerald-500">{formatCurrency(income)}</p>
                </div>

                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingDown className="w-16 h-16 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Gastos (Total)</p>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
                </div>

                <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="w-16 h-16 text-indigo-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                        {formatCurrency(balance)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transactions List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-heading font-semibold px-1">Movimientos del mes</h2>
                    <div className="glass rounded-2xl border border-border/50 overflow-hidden">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                No hay movimientos este mes.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
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
                    <div className="space-y-3">
                        {debts.length === 0 ? (
                            <div className="glass p-8 text-center rounded-2xl border border-dashed border-border border-emerald-500/20">
                                <p className="text-sm text-emerald-500 font-medium">¡Libre de deudas!</p>
                            </div>
                        ) : debts.map(debt => {
                            const progress = 100 - (debt.remaining_amount / debt.total_amount * 100)
                            return (
                                <div key={debt.id} className="glass p-5 rounded-2xl border border-red-500/20 bg-card relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-2">
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
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Transaction Modal */}
            <AnimatePresence>
                {isTxFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTxFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Movimiento</h2>
                                <button onClick={() => setIsTxFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleTxSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Tipo</label>
                                        <select name="type" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 appearance-none">
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
                                        <select name="debt_id" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none">
                                            <option value="">-- No es deuda --</option>
                                            {debts.map(d => <option key={d.id} value={d.id}>{d.creditor}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsTxFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'tx'} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'tx' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Debt Modal */}
            <AnimatePresence>
                {isDebtFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDebtFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nueva Deuda</h2>
                                <button onClick={() => setIsDebtFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={handleDebtSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Acreedor / Nombre</label>
                                    <input required name="creditor" placeholder="Ej. Tarjeta de Crédito, Préstamo Auto..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Monto Total ($)</label>
                                        <input required type="number" step="0.01" name="total_amount" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Día de vencimiento</label>
                                        <input required type="number" min="1" max="31" name="due_day" placeholder="1-31" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500" />
                                    </div>
                                </div>
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsDebtFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'debt'} type="submit" className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'debt' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
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
