'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Plus, X, TrendingDown, TrendingUp } from 'lucide-react'
import { createTransaction } from '@/lib/actions/finances'

export function QuickTransactionModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [type, setType] = useState<'Income' | 'Fixed_Expense' | 'Variable' | 'Debt_Payment'>('Variable')
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit'
    })
    const parts = formatter.formatToParts(now)
    const yr = parts.find(p => p.type === 'year')?.value
    const mo = parts.find(p => p.type === 'month')?.value
    const monthYear = `${yr}-${mo}`

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!description.trim() || !amount) return
        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('type', type)
            formData.append('description', description)
            formData.append('amount', amount)
            formData.append('month_year', monthYear)

            await createTransaction(formData)
            setDescription('')
            setAmount('')
            setIsOpen(false)
            window.location.reload()
        } catch (e) {
            alert('Error registrando movimiento')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-2 rounded-2xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
                <DollarSign className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>+ Registrar Movimiento</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#161822] border border-indigo-500/30 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 relative space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-indigo-400" />
                                    Registrar Movimiento Rápido
                                </h3>
                                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white p-1 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">Tipo *</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'Income', label: '💰 Ingreso', color: 'emerald' },
                                            { value: 'Fixed_Expense', label: '🔒 Gasto Fijo', color: 'red' },
                                            { value: 'Variable', label: '🛒 Gasto Variable', color: 'orange' },
                                            { value: 'Debt_Payment', label: '💳 Pago Deuda', color: 'purple' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setType(opt.value as any)}
                                                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                                    type === opt.value
                                                        ? 'bg-indigo-600/30 border-indigo-400 text-white shadow'
                                                        : 'bg-black/20 border-white/10 text-muted-foreground hover:bg-white/5'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Descripción *</label>
                                    <input
                                        type="text"
                                        required
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Ej: Supermercado, Alquiler, Freelance..."
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Monto ($ ARS) *</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="15000"
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="pt-2 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                                    >
                                        {loading ? 'Guardando...' : 'Guardar en Finanzas'}
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
