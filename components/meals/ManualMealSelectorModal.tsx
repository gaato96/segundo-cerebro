'use client'

import { useState } from 'react'
import { X, Search, Check, Utensils, Bike, PenTool } from 'lucide-react'

export function ManualMealSelectorModal({
    dayName,
    mealType,
    recipes,
    onClose,
    onSelect
}: {
    dayName: string
    mealType: 'Almuerzo' | 'Cena' | 'Almuerzo & Cena'
    recipes: any[]
    onClose: () => void
    onSelect: (recipeId: string, recipeName: string) => Promise<void>
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [customMeal, setCustomMeal] = useState('')
    const [saving, setSaving] = useState<string | null>(null)

    // Filter recipes based on search
    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const handleSelectRecipe = async (id: string, name: string) => {
        setSaving(id)
        try {
            await onSelect(id, name)
            onClose()
        } catch (e) {
            alert('Error guardando comida')
        } finally {
            setSaving(null)
        }
    }

    const handleSaveCustom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!customMeal.trim()) return
        setSaving('custom')
        try {
            await onSelect('custom', customMeal.trim())
            onClose()
        } catch (e) {
            alert('Error guardando comida personalizada')
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl relative overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-2xl font-heading font-bold">Cambiar Comida</h2>
                        <p className="text-sm text-indigo-400 font-medium mt-1">
                            {dayName} — {mealType}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Quick options */}
                    <div className="flex gap-2">
                        <button
                            disabled={saving === 'delivery'}
                            onClick={() => handleSelectRecipe('delivery', '🛵 Delivery / Pedir Comida')}
                            className="flex-1 p-3.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-2xl border border-yellow-500/20 transition-all font-semibold flex flex-col items-center gap-1 text-sm disabled:opacity-50"
                        >
                            <Bike className="w-5 h-5 animate-bounce" />
                            Pedir Delivery
                        </button>
                        <button
                            disabled={saving === 'none'}
                            onClick={() => handleSelectRecipe('', '')}
                            className="flex-1 p-3.5 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-white rounded-2xl border border-border/50 transition-all font-semibold flex flex-col items-center gap-1 text-sm disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                            Quitar Asignación
                        </button>
                    </div>

                    {/* Custom Meal Form */}
                    <form onSubmit={handleSaveCustom} className="space-y-2 border-t border-white/5 pt-4">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block">¿Comiste otra cosa? Escríbela aquí</label>
                        <div className="flex gap-2">
                            <input
                                required
                                type="text"
                                value={customMeal}
                                onChange={(e) => setCustomMeal(e.target.value)}
                                placeholder="Ej: Asado en familia, Ensalada rápida, etc."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={saving === 'custom'}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow"
                            >
                                {saving === 'custom' ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>

                    {/* Recipes catalog list */}
                    <div className="space-y-3 border-t border-white/5 pt-4">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block">Seleccionar de mis recetas</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar receta..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none"
                            />
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        </div>

                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                            {filteredRecipes.map(recipe => (
                                <button
                                    key={recipe.id}
                                    disabled={saving !== null}
                                    onClick={() => handleSelectRecipe(recipe.id, recipe.name)}
                                    className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Utensils className="w-4 h-4 text-indigo-400 shrink-0" />
                                        <span className="font-semibold text-sm truncate">{recipe.name}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold shrink-0">
                                        {recipe.complexity === 'Fast' ? 'Rápida' : recipe.complexity === 'Complex' ? 'Compleja' : 'Media'}
                                    </span>
                                </button>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <div className="text-center py-6 text-xs text-muted-foreground">
                                    No se encontraron recetas con ese nombre.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
