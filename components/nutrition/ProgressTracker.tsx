'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Scale, TrendingDown, Calendar, Loader2, Smile, Frown, Meh, Award } from 'lucide-react'
import { addProgressEntry } from '@/lib/actions/nutrition'
import { formatDate } from '@/lib/utils'

interface ProgressTrackerProps {
    history: any[]
    onAdded?: () => void
}

export function ProgressTracker({ history = [], onAdded }: ProgressTrackerProps) {
    const [weight, setWeight] = useState<number | ''>('')
    const [waist, setWaist] = useState<number | ''>('')
    const [feeling, setFeeling] = useState<'great' | 'good' | 'ok' | 'bad'>('good')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!weight || loading) return

        setLoading(true)
        try {
            await addProgressEntry({
                weight_kg: Number(weight),
                waist_cm: waist ? Number(waist) : undefined,
                feeling,
                notes
            })
            setWeight('')
            setWaist('')
            setNotes('')
            setShowForm(false)
            onAdded?.()
        } catch (err) {
            console.error(err)
            alert('Error al guardar registro')
        } finally {
            setLoading(false)
        }
    }

    const firstWeight = history[0]?.weight_kg
    const latestWeight = history[history.length - 1]?.weight_kg
    const weightDiff = firstWeight && latestWeight ? (latestWeight - firstWeight).toFixed(1) : null

    // SVG Line Graph calculation
    const weights = history.map(h => Number(h.weight_kg)).filter(w => !isNaN(w) && w > 0)
    const minW = weights.length > 0 ? Math.min(...weights) - 1 : 60
    const maxW = weights.length > 0 ? Math.max(...weights) + 1 : 90
    const rangeW = maxW - minW || 1

    const svgPoints = history.map((item, idx) => {
        const x = history.length === 1 ? 200 : (idx / (history.length - 1)) * 360 + 20
        const y = 160 - ((Number(item.weight_kg) - minW) / rangeW) * 120
        return { x, y, weight: item.weight_kg, date: formatDate(item.date) }
    })

    const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(' ')

    return (
        <div className="space-y-6">
            {/* Top Stat Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl border border-emerald-500/20 text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Último Peso Medido</span>
                    <div className="text-3xl font-heading font-extrabold text-emerald-400 mt-1">
                        {latestWeight ? `${latestWeight} kg` : '--'}
                    </div>
                </div>

                <div className="glass p-5 rounded-2xl border border-border/50 text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evolución Total</span>
                    <div className={`text-3xl font-heading font-extrabold mt-1 ${
                        Number(weightDiff) < 0 ? 'text-green-400' : 'text-amber-400'
                    }`}>
                        {weightDiff ? `${weightDiff} kg` : '0 kg'}
                    </div>
                </div>

                <div className="glass p-5 rounded-2xl border border-border/50 text-center flex flex-col items-center justify-center">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Registrar Medición
                    </button>
                </div>
            </div>

            {/* Add Measurement Form */}
            {showForm && (
                <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onSubmit={handleSubmit}
                    className="glass p-6 rounded-2xl border border-emerald-500/30 space-y-4"
                >
                    <h4 className="text-sm font-bold text-foreground">Nuevo Registro de Progreso</h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Peso Actual (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                required
                                placeholder="Ej. 74.5"
                                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cintura (cm - Opcional)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={waist}
                                onChange={(e) => setWaist(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="Ej. 82"
                                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">¿Cómo te sentís?</label>
                        <div className="flex gap-2">
                            {[
                                { val: 'great', label: '😄 Excelente' },
                                { val: 'good', label: '🙂 Bien' },
                                { val: 'ok', label: '😐 Normal' },
                                { val: 'bad', label: '🙁 Cansado' }
                            ].map((item) => (
                                <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setFeeling(item.val as any)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                                        feeling === item.val
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md flex items-center gap-1.5"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Guardar Registro
                        </button>
                    </div>
                </motion.form>
            )}

            {/* Custom SVG Weight Graph */}
            {history.length > 0 ? (
                <div className="glass p-6 rounded-2xl border border-border/50 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">Evolución del Peso</h4>
                        <span className="text-xs text-muted-foreground">{history.length} registros</span>
                    </div>

                    <div className="w-full overflow-x-auto">
                        <svg viewBox="0 0 400 200" className="w-full h-48 stroke-current">
                            {/* Grid lines */}
                            <line x1="20" y1="40" x2="380" y2="40" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                            <line x1="20" y1="100" x2="380" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                            <line x1="20" y1="160" x2="380" y2="160" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />

                            {/* Polyline */}
                            {svgPoints.length > 1 && (
                                <polyline
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="3"
                                    points={polylinePoints}
                                />
                            )}

                            {/* Data dots & labels */}
                            {svgPoints.map((pt, idx) => (
                                <g key={idx}>
                                    <circle cx={pt.x} cy={pt.y} r="5" fill="#10b981" />
                                    <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">
                                        {pt.weight}kg
                                    </text>
                                    <text x={pt.x} y="190" textAnchor="middle" fill="#94a3b8" fontSize="9">
                                        {pt.date}
                                    </text>
                                </g>
                            ))}
                        </svg>
                    </div>
                </div>
            ) : (
                <div className="glass p-8 rounded-2xl text-center border border-dashed border-border text-muted-foreground text-xs">
                    No tenés registros de peso acumulados aún. ¡Añadí el primero!
                </div>
            )}
        </div>
    )
}
