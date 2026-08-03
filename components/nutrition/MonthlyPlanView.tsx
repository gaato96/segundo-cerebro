'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Utensils, RefreshCw, Check, Flame, ChevronRight, ChevronLeft, Sparkles, Coffee, Sun, Moon, Cookie, Loader2 } from 'lucide-react'
import { swapMeal } from '@/lib/actions/nutrition'

interface MonthlyPlanViewProps {
    plan: any
    onPlanUpdated?: () => void
}

const MEAL_ICONS: Record<string, any> = {
    desayuno: Coffee,
    almuerzo: Sun,
    merienda: Cookie,
    cena: Moon
}

const MEAL_COLORS: Record<string, string> = {
    desayuno: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    almuerzo: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    merienda: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    cena: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
}

export function MonthlyPlanView({ plan, onPlanUpdated }: MonthlyPlanViewProps) {
    const [selectedDayIndex, setSelectedDayIndex] = useState(0)
    const [swappingMeal, setSwappingMeal] = useState<string | null>(null)
    const [approvedMeals, setApprovedMeals] = useState<Record<string, boolean>>({})

    if (!plan || !plan.plan_data || !plan.plan_data.days) {
        return (
            <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                <Utensils className="w-12 h-12 text-emerald-400 mb-4 opacity-80" />
                <h3 className="text-lg font-heading font-bold text-foreground">No tenés un plan mensual activo</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Generá tu plan desde el Panel para ver las dietas semanales diseñadas por el Nutricionista IA.
                </p>
            </div>
        )
    }

    const days = plan.plan_data.days
    const currentDay = days[selectedDayIndex] || days[0]

    async function handleSwap(mealType: string) {
        const key = `${selectedDayIndex}-${mealType}`
        setSwappingMeal(key)
        try {
            await swapMeal(plan.id, currentDay.day_number || (selectedDayIndex + 1), mealType, 'Deseo variar este plato')
            onPlanUpdated?.()
        } catch (err) {
            console.error(err)
            alert('Error al cambiar la comida')
        } finally {
            setSwappingMeal(null)
        }
    }

    function toggleApprove(mealType: string) {
        const key = `${selectedDayIndex}-${mealType}`
        setApprovedMeals(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <div className="space-y-6">
            {/* Day Selector */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 no-scrollbar">
                {days.map((day: any, idx: number) => {
                    const isSelected = idx === selectedDayIndex
                    return (
                        <button
                            key={idx}
                            onClick={() => setSelectedDayIndex(idx)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                                isSelected
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                                    : 'glass text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-border/50'
                            }`}
                        >
                            {day.day_name || `Día ${day.day_number || idx + 1}`}
                        </button>
                    )
                })}
            </div>

            {/* Meals for Selected Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['desayuno', 'almuerzo', 'merienda', 'cena'].map((mealType) => {
                    const meal = currentDay.meals?.[mealType]
                    const Icon = MEAL_ICONS[mealType] || Utensils
                    const colorClass = MEAL_COLORS[mealType] || 'text-emerald-400 bg-emerald-500/10'
                    const key = `${selectedDayIndex}-${mealType}`
                    const isApproved = approvedMeals[key]
                    const isSwapping = swappingMeal === key

                    if (!meal) return null

                    return (
                        <motion.div
                            key={mealType}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`glass p-5 rounded-2xl border transition-all ${
                                isApproved ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/50'
                            }`}
                        >
                            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`p-2 rounded-xl border ${colorClass}`}>
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">{mealType}</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Flame className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="font-semibold text-foreground">{meal.calories}</span> kcal
                                </div>
                            </div>

                            <h4 className="text-base font-bold text-foreground mb-2">{meal.name}</h4>

                            {/* Macros Row */}
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 bg-secondary/40 p-2 rounded-lg border border-border/30">
                                <span>💪 Prot: <strong>{meal.protein}g</strong></span>
                                <span>🌾 Carbs: <strong>{meal.carbs}g</strong></span>
                                <span>🥑 Grasas: <strong>{meal.fat}g</strong></span>
                            </div>

                            {/* Ingredients */}
                            {meal.ingredients && meal.ingredients.length > 0 && (
                                <div className="text-xs text-muted-foreground/90 space-y-1 mb-4">
                                    <span className="font-semibold text-foreground/80 text-[11px]">Ingredientes:</span>
                                    <p className="line-clamp-2 italic">{meal.ingredients.join(', ')}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                                <button
                                    onClick={() => toggleApprove(mealType)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                        isApproved
                                            ? 'bg-emerald-600 text-white shadow-md'
                                            : 'bg-secondary hover:bg-emerald-500/10 hover:text-emerald-400 text-muted-foreground border border-border/50'
                                    }`}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    {isApproved ? 'Aprobada' : 'Aprobar'}
                                </button>

                                <button
                                    onClick={() => handleSwap(mealType)}
                                    disabled={isSwapping}
                                    className="py-2 px-3 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-xl text-xs font-medium border border-border/50 transition-all flex items-center gap-1.5"
                                    title="Pedir otra opción a la IA"
                                >
                                    {isSwapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    Cambiar
                                </button>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
