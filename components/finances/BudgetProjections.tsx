'use client'

import { useState } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Sparkles, Layers, ArrowRight, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { BudgetProjectionItem, createBudgetProjection, deleteBudgetProjection } from '@/lib/actions/budget_projections'
import { createEnvelope } from '@/lib/actions/budget_envelopes'

interface BudgetProjectionsProps {
    projections: BudgetProjectionItem[]
    monthYear: string
}

const CATEGORY_PRESETS = ['Alquiler / Casa', 'Servicios / Utilidades', 'Supermercado', 'Salidas / Ocio', 'Salud & Meds', 'Educación', 'Transporte', 'Ahorro / Inversión']

export function BudgetProjections({ projections: initialProjections, monthYear }: BudgetProjectionsProps) {
    const [projections, setProjections] = useState<BudgetProjectionItem[]>(initialProjections)
    const [desc, setDesc] = useState('')
    const [amount, setAmount] = useState('')
    const [type, setType] = useState<'income' | 'expense'>('expense')
    const [category, setCategory] = useState(CATEGORY_PRESETS[0])
    const [loading, setLoading] = useState(false)
    const [generatingEnvelopes, setGeneratingEnvelopes] = useState(false)

    const incomes = projections.filter(p => p.type === 'income')
    const expenses = projections.filter(p => p.type === 'expense')

    const totalIncome = incomes.reduce((sum, p) => sum + p.amount, 0)
    const totalExpenses = expenses.reduce((sum, p) => sum + p.amount, 0)
    const projectedBalance = totalIncome - totalExpenses

    async function handleAddProjection(e: React.FormEvent) {
        e.preventDefault()
        if (!desc.trim() || !amount) return

        setLoading(true)
        const formData = new FormData()
        formData.append('month_year', monthYear)
        formData.append('type', type)
        formData.append('description', desc)
        formData.append('amount', amount)
        formData.append('category', category)

        const res = await createBudgetProjection(formData)
        setLoading(false)

        if (res.success) {
            setDesc('')
            setAmount('')
            window.location.reload()
        } else {
            alert(res.error)
        }
    }

    async function handleDelete(id: string) {
        await deleteBudgetProjection(id)
        setProjections(prev => prev.filter(p => p.id !== id))
    }

    async function handleGenerateEnvelopes() {
        if (expenses.length === 0) {
            alert('No hay gastos proyectados para generar sobres.')
            return
        }

        if (!confirm(`¿Generar ${expenses.length} sobres de presupuesto basados en tus gastos proyectados de ${monthYear}?`)) return

        setGeneratingEnvelopes(true)
        const colorPalette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6']

        for (let i = 0; i < expenses.length; i++) {
            const exp = expenses[i]
            const formData = new FormData()
            formData.append('month_year', monthYear)
            formData.append('category', exp.description || exp.category || 'Sobre')
            formData.append('allocated_amount', exp.amount.toString())
            formData.append('color_hex', colorPalette[i % colorPalette.length])

            await createEnvelope(formData)
        }

        setGeneratingEnvelopes(false)
        alert('¡Sobres de presupuesto creados con éxito desde tu proyección!')
        window.location.reload()
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPI Balance Banner */}
            <div className="glass p-6 rounded-3xl border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-heading font-bold text-lg text-white">Proyección de Presupuesto ({monthYear})</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Planificá tus ingresos y gastos estimados para este mes en Pesos Argentinos (ARS).
                    </p>
                </div>

                <div className="flex items-center gap-4 text-right">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Balance Proyectado</span>
                        <span className={`text-xl font-bold font-mono ${projectedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(projectedBalance)}
                        </span>
                    </div>

                    {expenses.length > 0 && (
                        <button
                            onClick={handleGenerateEnvelopes}
                            disabled={generatingEnvelopes}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                            {generatingEnvelopes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                            Generar Sobres ({expenses.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddProjection} className="glass p-4 rounded-2xl border border-border/50 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                    <option value="expense">🔴 Gasto Proyectado</option>
                    <option value="income">🟢 Ingreso Proyectado</option>
                </select>

                <input
                    type="text"
                    required
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Descripción (ej: Sueldo, Alquiler...)"
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:col-span-2"
                />

                <input
                    type="number"
                    required
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Monto ($ ARS)"
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Agregar</>}
                </button>
            </form>

            {/* Projections Grid: 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Column */}
                <div className="glass p-5 rounded-3xl border border-emerald-500/20 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h4 className="font-heading font-bold text-base text-white">Ingresos Proyectados</h4>
                        </div>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                            {formatCurrency(totalIncome)}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {incomes.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-6">Sin ingresos proyectados aún.</p>
                        ) : (
                            incomes.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                                    <div>
                                        <p className="font-bold text-white">{p.description}</p>
                                        <span className="text-[10px] text-muted-foreground">{p.category}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-emerald-400">{formatCurrency(p.amount)}</span>
                                        <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Expense Column */}
                <div className="glass p-5 rounded-3xl border border-red-500/20 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-red-400" />
                            <h4 className="font-heading font-bold text-base text-white">Gastos Proyectados</h4>
                        </div>
                        <span className="text-sm font-bold font-mono text-red-400">
                            {formatCurrency(totalExpenses)}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {expenses.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-6">Sin gastos proyectados aún.</p>
                        ) : (
                            expenses.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs">
                                    <div>
                                        <p className="font-bold text-white">{p.description}</p>
                                        <span className="text-[10px] text-muted-foreground">{p.category}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-red-400">{formatCurrency(p.amount)}</span>
                                        <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
