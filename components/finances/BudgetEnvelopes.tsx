'use client'

import { BudgetEnvelopeItem } from '@/lib/actions/budget_envelopes'
import { formatCurrency } from '@/lib/utils'
import { Wallet, Plus, Trash2 } from 'lucide-react'

interface BudgetEnvelopesProps {
    envelopes: BudgetEnvelopeItem[]
    totalIncome: number
    onAddEnvelope: () => void
    onDeleteEnvelope: (id: string) => void
}

export function BudgetEnvelopes({ envelopes, totalIncome, onAddEnvelope, onDeleteEnvelope }: BudgetEnvelopesProps) {
    const totalAllocated = envelopes.reduce((sum, e) => sum + e.allocated_amount, 0)
    const unallocatedIncome = Math.max(0, totalIncome - totalAllocated)

    return (
        <div className="space-y-6">
            {/* Income Distribution Overview */}
            <div className="glass p-6 rounded-3xl border border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-heading font-bold text-lg text-white">
                            Planificación de Sobres de Presupuesto
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Asigná tus ingresos a categorías específicas antes de gastar.
                        </p>
                    </div>

                    <button
                        onClick={onAddEnvelope}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                        <Plus className="w-4 h-4" /> Agregar Categoría
                    </button>
                </div>

                {/* Progress bar of Income allocation */}
                <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-semibold">Ingreso Asignado: {formatCurrency(totalAllocated)} / {formatCurrency(totalIncome)}</span>
                        <span className="font-mono font-bold text-emerald-400">Sin Asignar: {formatCurrency(unallocatedIncome)}</span>
                    </div>
                    <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden flex">
                        {envelopes.map((e) => {
                            const pct = totalIncome > 0 ? (e.allocated_amount / totalIncome) * 100 : 0
                            return (
                                <div
                                    key={e.id}
                                    style={{ width: `${pct}%`, backgroundColor: e.color_hex }}
                                    className="h-full transition-all"
                                    title={`${e.category}: ${pct.toFixed(1)}%`}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Envelopes Grid */}
            {envelopes.length === 0 ? (
                <div className="glass p-8 text-center rounded-3xl border border-border/50 text-xs text-muted-foreground italic">
                    No tenés sobres de presupuesto definidos este mes. Creá una categoría (Alimentación, Ahorro, Servicios, etc).
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {envelopes.map((e) => {
                        const spentPct = e.allocated_amount > 0 ? Math.min(100, Math.round((e.spent_amount / e.allocated_amount) * 100)) : 0
                        const remaining = e.allocated_amount - e.spent_amount

                        return (
                            <div
                                key={e.id}
                                className="glass rounded-2xl p-5 border border-border/50 space-y-3 relative group"
                                style={{ borderLeftWidth: 4, borderLeftColor: e.color_hex }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4 text-indigo-400" />
                                        <h4 className="font-bold text-white text-base">{e.category}</h4>
                                    </div>
                                    <button
                                        onClick={() => onDeleteEnvelope(e.id)}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex items-baseline justify-between">
                                    <span className="text-xs text-muted-foreground font-semibold">Presupuesto</span>
                                    <span className="text-base font-bold font-mono text-white">{formatCurrency(e.allocated_amount)}</span>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted-foreground">Gastado: {formatCurrency(e.spent_amount)}</span>
                                        <span className={`font-mono font-bold ${remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            Disp: {formatCurrency(remaining)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${spentPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
