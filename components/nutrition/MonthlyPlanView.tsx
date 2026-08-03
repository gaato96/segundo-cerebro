'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Utensils, RefreshCw, Check, Flame, Coffee, Sun, Moon, Cookie,
    Loader2, BookOpen, ShoppingBag, Copy, X, BookmarkCheck, PartyPopper, CheckCircle2
} from 'lucide-react'
import {
    swapMeal, updateSelectedMealOption, copyMeal, saveNutritionMealAsRecipe,
    approveAndSyncNutritionMeal
} from '@/lib/actions/nutrition'

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

export function MonthlyPlanView({ plan }: MonthlyPlanViewProps) {
    const [selectedDayIndex, setSelectedDayIndex] = useState(0)
    const [planData, setPlanData] = useState<any>(plan?.plan_data)
    const [swappingMeal, setSwappingMeal] = useState<string | null>(null)
    const [copyingMeal, setCopyingMeal] = useState<string | null>(null)
    const [syncingMeal, setSyncingMeal] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    // Sync state if plan prop changes
    useEffect(() => {
        if (plan?.plan_data) {
            setPlanData(plan.plan_data)
        }
    }, [plan])

    // Modal state for recipe view
    const [activeRecipe, setActiveRecipe] = useState<{
        name: string
        ingredients: string[]
        instructions: string
        calories?: number
        protein?: number
        carbs?: number
        fat?: number
    } | null>(null)
    const [savingRecipe, setSavingRecipe] = useState(false)
    const [recipeSaved, setRecipeSaved] = useState(false)

    // Modal state for Shopping List of current day
    const [showShoppingList, setShowShoppingList] = useState(false)

    if (!planData || !planData.days) {
        return (
            <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                <Utensils className="w-12 h-12 text-emerald-400 mb-4 opacity-80" />
                <h3 className="text-lg font-heading font-bold text-foreground">No tenés un plan mensual activo</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Generá tu plan desde el Panel para ver las opciones diseñadas por el Nutricionista IA.
                </p>
            </div>
        )
    }

    const days = planData.days
    const currentDay = days[selectedDayIndex] || days[0]
    const cheatRecommendation = planData.cheat_meal_recommendation

    function showToast(msg: string) {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 4000)
    }

    // Extract active meal option
    function getActiveOption(mealContainer: any) {
        if (!mealContainer) return null
        if (mealContainer.options && Array.isArray(mealContainer.options)) {
            const idx = mealContainer.selected_option || 0
            return mealContainer.options[idx] || mealContainer.options[0]
        }
        return mealContainer // legacy format fallback
    }

    async function handleOptionSelect(mealType: string, optIndex: number) {
        // Optimistic UI update
        const updatedDays = [...planData.days]
        const dayObj = updatedDays[selectedDayIndex]
        if (dayObj && dayObj.meals && dayObj.meals[mealType]) {
            dayObj.meals[mealType].selected_option = optIndex
        }
        setPlanData({ ...planData, days: updatedDays })

        // Background server call
        try {
            await updateSelectedMealOption(plan.id, currentDay.day_number || (selectedDayIndex + 1), mealType, optIndex)
        } catch (err) {
            console.error(err)
        }
    }

    async function handleCopyMeal(sourceMealType: string, targetMealType: string) {
        const key = `${selectedDayIndex}-${sourceMealType}-${targetMealType}`
        setCopyingMeal(key)

        // Optimistic UI update
        const updatedDays = [...planData.days]
        const dayObj = updatedDays[selectedDayIndex]
        if (dayObj && dayObj.meals && dayObj.meals[sourceMealType]) {
            dayObj.meals[targetMealType] = JSON.parse(JSON.stringify(dayObj.meals[sourceMealType]))
        }
        setPlanData({ ...planData, days: updatedDays })

        try {
            await copyMeal(plan.id, currentDay.day_number || (selectedDayIndex + 1), sourceMealType, targetMealType)
            showToast(`Copiado ${sourceMealType} a ${targetMealType} correctamente.`)
        } catch (err) {
            console.error(err)
            alert('Error al copiar la comida')
        } finally {
            setCopyingMeal(null)
        }
    }

    async function handleSwap(mealType: string) {
        const key = `${selectedDayIndex}-${mealType}`
        setSwappingMeal(key)
        try {
            const newMeal = await swapMeal(plan.id, currentDay.day_number || (selectedDayIndex + 1), mealType, 'Deseo otra opción')
            if (newMeal) {
                const updatedDays = [...planData.days]
                const dayObj = updatedDays[selectedDayIndex]
                if (dayObj && dayObj.meals) {
                    dayObj.meals[mealType] = newMeal
                }
                setPlanData({ ...planData, days: updatedDays })
                showToast(`Comida ${mealType} renovada por la IA.`)
            }
        } catch (err) {
            console.error(err)
            alert('Error al cambiar la comida')
        } finally {
            setSwappingMeal(null)
        }
    }

    async function handleToggleApprove(mealType: string) {
        const key = `${selectedDayIndex}-${mealType}`
        const mealContainer = currentDay.meals?.[mealType]
        const currentApproved = !!mealContainer?.approved
        const nextApproved = !currentApproved

        setSyncingMeal(key)

        // Optimistic UI update
        const updatedDays = [...planData.days]
        const dayObj = updatedDays[selectedDayIndex]
        if (dayObj && dayObj.meals && dayObj.meals[mealType]) {
            dayObj.meals[mealType].approved = nextApproved
        }
        setPlanData({ ...planData, days: updatedDays })

        try {
            await approveAndSyncNutritionMeal(
                plan.id,
                currentDay.day_number || (selectedDayIndex + 1),
                mealType,
                nextApproved
            )
            if (nextApproved) {
                showToast(`✅ Comida aprobada y sincronizada con tu Planificador de Comidas semanal!`)
            } else {
                showToast(`Comida marcada como no aprobada.`)
            }
        } catch (err) {
            console.error(err)
            alert('Error al aprobar y sincronizar la comida')
        } finally {
            setSyncingMeal(null)
        }
    }

    async function handleSaveRecipe() {
        if (!activeRecipe) return
        setSavingRecipe(true)
        try {
            await saveNutritionMealAsRecipe({
                name: activeRecipe.name,
                ingredients: activeRecipe.ingredients || [],
                instructions: activeRecipe.instructions || '',
                protein: activeRecipe.protein,
                carbs: activeRecipe.carbs
            })
            setRecipeSaved(true)
            setTimeout(() => setRecipeSaved(false), 3000)
            showToast(`Receta "${activeRecipe.name}" guardada en tu recetario.`)
        } catch (err) {
            console.error(err)
            alert('Error al guardar en el recetario')
        } finally {
            setSavingRecipe(false)
        }
    }

    // Collect all ingredients for current day's selected options
    const dayIngredients: { mealType: string; mealName: string; list: string[] }[] = []
    if (currentDay && currentDay.meals) {
        ['desayuno', 'almuerzo', 'merienda', 'cena'].forEach(mType => {
            const activeOpt = getActiveOption(currentDay.meals[mType])
            if (activeOpt && activeOpt.ingredients) {
                dayIngredients.push({
                    mealType: mType,
                    mealName: activeOpt.name,
                    list: activeOpt.ingredients
                })
            }
        })
    }

    return (
        <div className="space-y-6 relative">
            {/* Toast feedback Banner */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between shadow-lg"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                            <span>{toastMessage}</span>
                        </div>
                        <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cheat Meal & AI Recommendation Banner */}
            {cheatRecommendation && (
                <div className="glass p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                            <PartyPopper className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Comida Libre / Permitido</span>
                            <p className="text-xs text-foreground/90 font-medium">{cheatRecommendation}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowShoppingList(true)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-md"
                    >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Compras del día
                    </button>
                </div>
            )}

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

            {/* Meals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {['desayuno', 'almuerzo', 'merienda', 'cena'].map((mealType) => {
                    const mealContainer = currentDay.meals?.[mealType]
                    if (!mealContainer) return null

                    const activeMeal = getActiveOption(mealContainer)
                    const Icon = MEAL_ICONS[mealType] || Utensils
                    const colorClass = MEAL_COLORS[mealType] || 'text-emerald-400 bg-emerald-500/10'
                    const key = `${selectedDayIndex}-${mealType}`
                    const isApproved = !!mealContainer.approved
                    const isSwapping = swappingMeal === key
                    const isSyncing = syncingMeal === key
                    const hasMultipleOptions = mealContainer.options && Array.isArray(mealContainer.options) && mealContainer.options.length > 1
                    const selectedOptIndex = mealContainer.selected_option || 0

                    if (!activeMeal) return null

                    return (
                        <motion.div
                            key={mealType}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`glass p-5 rounded-2xl border transition-all space-y-4 ${
                                isApproved ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30' : 'border-border/50'
                            }`}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`p-2 rounded-xl border ${colorClass}`}>
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">{mealType}</span>
                                    {activeMeal.is_cheat_meal && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                                            🎉 Permitido
                                        </span>
                                    )}
                                    {isApproved && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Aprobada & Sincronizada
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Flame className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="font-semibold text-foreground">{activeMeal.calories}</span> kcal
                                </div>
                            </div>

                            {/* 3 Options Selector */}
                            {hasMultipleOptions && (
                                <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/40">
                                    {mealContainer.options.map((opt: any, optIdx: number) => (
                                        <button
                                            key={optIdx}
                                            onClick={() => handleOptionSelect(mealType, optIdx)}
                                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                                selectedOptIndex === optIdx
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Opción {optIdx + 1}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Title & Macros */}
                            <div>
                                <h4 className="text-base font-bold text-foreground mb-2 leading-snug">{activeMeal.name}</h4>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-secondary/40 p-2 rounded-lg border border-border/30">
                                    <span>💪 Prot: <strong>{activeMeal.protein}g</strong></span>
                                    <span>🌾 Carbs: <strong>{activeMeal.carbs}g</strong></span>
                                    <span>🥑 Grasas: <strong>{activeMeal.fat}g</strong></span>
                                </div>
                            </div>

                            {/* Ingredients preview */}
                            {activeMeal.ingredients && activeMeal.ingredients.length > 0 && (
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <span className="font-semibold text-foreground/80 text-[11px]">Ingredientes:</span>
                                    <p className="line-clamp-2 italic">{activeMeal.ingredients.join(', ')}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                                <button
                                    onClick={() => setActiveRecipe(activeMeal)}
                                    className="flex-1 py-2 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Ver Receta
                                </button>

                                {mealType === 'almuerzo' && (
                                    <button
                                        onClick={() => handleCopyMeal('almuerzo', 'cena')}
                                        disabled={!!copyingMeal}
                                        className="py-2 px-3 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-xl text-xs font-medium border border-border/50 transition-all flex items-center gap-1.5"
                                        title="Copiar almuerzo a la cena"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        Repetir en Cena
                                    </button>
                                )}

                                {mealType === 'desayuno' && (
                                    <button
                                        onClick={() => handleCopyMeal('desayuno', 'merienda')}
                                        disabled={!!copyingMeal}
                                        className="py-2 px-3 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-xl text-xs font-medium border border-border/50 transition-all flex items-center gap-1.5"
                                        title="Copiar desayuno a la merienda"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        Repetir en Merienda
                                    </button>
                                )}

                                <button
                                    onClick={() => handleSwap(mealType)}
                                    disabled={isSwapping}
                                    className="py-2 px-2.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-xl text-xs font-medium border border-border/50 transition-all flex items-center gap-1"
                                    title="Generar nueva alternativa con IA"
                                >
                                    {isSwapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                    onClick={() => handleToggleApprove(mealType)}
                                    disabled={isSyncing}
                                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                        isApproved
                                            ? 'bg-emerald-600 text-white shadow-md'
                                            : 'bg-secondary hover:bg-emerald-500/10 hover:text-emerald-400 text-muted-foreground border border-border/50'
                                    }`}
                                >
                                    {isSyncing ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Check className="w-3.5 h-3.5" />
                                    )}
                                    {isApproved ? 'Aprobada' : 'Aprobar'}
                                </button>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* RECIPE MODAL */}
            <AnimatePresence>
                {activeRecipe && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass rounded-2xl max-w-lg w-full p-6 border border-emerald-500/30 space-y-5 max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                <div>
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Receta Completa</span>
                                    <h3 className="text-lg font-bold text-foreground mt-0.5">{activeRecipe.name}</h3>
                                </div>
                                <button
                                    onClick={() => setActiveRecipe(null)}
                                    className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Macros summary */}
                            <div className="flex items-center justify-around bg-secondary/50 p-3 rounded-xl border border-border/40 text-xs">
                                <span>🔥 <strong>{activeRecipe.calories || 400}</strong> kcal</span>
                                <span>💪 <strong>{activeRecipe.protein || 30}g</strong> prot</span>
                                <span>🌾 <strong>{activeRecipe.carbs || 40}g</strong> carbs</span>
                                <span>🥑 <strong>{activeRecipe.fat || 12}g</strong> grasa</span>
                            </div>

                            {/* Ingredients List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Ingredientes necesarios</h4>
                                <ul className="space-y-1.5">
                                    {activeRecipe.ingredients?.map((ing, i) => (
                                        <li key={i} className="text-xs text-foreground flex items-center gap-2 bg-secondary/30 p-2.5 rounded-lg border border-border/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                            <span>{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Instructions */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Pasos de preparación</h4>
                                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-secondary/30 p-3 rounded-xl border border-border/30">
                                    {activeRecipe.instructions || 'Preparar los ingredientes a fuego medio. Cocinar hasta dorar y servir caliente.'}
                                </p>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                                <button
                                    onClick={handleSaveRecipe}
                                    disabled={savingRecipe || recipeSaved}
                                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                                >
                                    {savingRecipe ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : recipeSaved ? (
                                        <BookmarkCheck className="w-4 h-4 text-emerald-200" />
                                    ) : (
                                        <BookOpen className="w-4 h-4" />
                                    )}
                                    {recipeSaved ? '¡Guardada en Mis Recetas!' : 'Guardar en mi Recetario'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* SHOPPING LIST MODAL */}
            <AnimatePresence>
                {showShoppingList && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 space-y-5 max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                        <ShoppingBag className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-foreground">Lista de Compras</h3>
                                        <p className="text-xs text-muted-foreground">{currentDay.day_name || 'Día seleccionado'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowShoppingList(false)}
                                    className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Compras recomendadas para las comidas elegidas de hoy:
                            </p>

                            <div className="space-y-4">
                                {dayIngredients.map((section, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                                            {section.mealType}: {section.mealName}
                                        </span>
                                        <ul className="space-y-1">
                                            {section.list.map((item, i) => (
                                                <li key={i} className="text-xs text-foreground flex items-center gap-2 bg-secondary/30 p-2 rounded-lg border border-border/30">
                                                    <input type="checkbox" className="rounded border-border text-emerald-600 focus:ring-emerald-500" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
