'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { deleteRecipe, importFrequentRecipes } from '@/lib/actions/meals'

interface Recipe {
    id: string
    name: string
    description?: string
    ingredients: any[]
    steps?: string
    complexity: string
}

export function RecipeManager({ recipes, onClose }: { recipes: Recipe[], onClose: () => void }) {
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)

    async function handleImportPresets() {
        setIsImporting(true)
        try {
            const result = await importFrequentRecipes()
            if (result.success) {
                alert(`¡Éxito! Se importaron ${result.count} nuevas recetas frecuentes. La página se actualizará.`);
                window.location.reload()
            }
        } catch (error: any) {
            alert('Error al importar: ' + error.message)
        } finally {
            setIsImporting(false)
        }
    }

    async function handleDelete(recipeId: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta receta? Si está en algún menú actual, este podría no mostrarse correctamente.')) return

        setIsDeleting(recipeId)
        try {
            const result = await deleteRecipe(recipeId)
            if (result.error) {
                alert('Error al eliminar: ' + result.error)
            } else {
                // Forzamos recarga para actualizar el estado local del cliente
                window.location.reload()
            }
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setIsDeleting(null)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl relative overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 flex-wrap gap-4">
                    <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
                        Mis Recetas
                        <span className="text-xs font-mono font-normal bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full">
                            {recipes.length} guardadas
                        </span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleImportPresets}
                            disabled={isImporting}
                            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Cargar Frecuentes
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {recipes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4">
                            <div className="flex flex-col items-center">
                                <AlertTriangle className="w-10 h-10 mb-3 opacity-50" />
                                <p>No tienes recetas guardadas.</p>
                                <p className="text-sm opacity-70">Añade algunas desde el formulario o importa las recetas frecuentes.</p>
                            </div>
                            <button
                                onClick={handleImportPresets}
                                disabled={isImporting}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors text-sm font-semibold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                            >
                                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Cargar 24 Recetas Frecuentes
                            </button>
                        </div>
                    ) : (
                        recipes.map((recipe) => (
                            <div key={recipe.id} className="bg-white/5 rounded-2xl p-4 flex justify-between items-center hover:bg-white/[0.07] transition-all border border-white/5">
                                <div>
                                    <h3 className="font-bold text-lg">{recipe.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-1">{recipe.description || 'Sin descripción'}</p>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-xs font-mono bg-white/10 text-white/70 px-2 py-0.5 rounded-md">
                                            {recipe.complexity === 'Fast' ? 'Rápida' : recipe.complexity === 'Complex' ? 'Compleja' : 'Media'}
                                        </span>
                                        <span className="text-xs font-mono bg-white/10 text-white/70 px-2 py-0.5 rounded-md">
                                            {recipe.ingredients?.length || 0} ingredientes
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(recipe.id)}
                                    disabled={isDeleting === recipe.id}
                                    className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 w-12 h-12"
                                >
                                    {isDeleting === recipe.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

