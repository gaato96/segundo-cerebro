'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { deleteRecipe } from '@/lib/actions/meals'

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

    async function handleDelete(recipeId: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta receta? Si está en algún menú actual, este podría no mostrarse correctamente.')) return

        setIsDeleting(recipeId)
        try {
            const result = await deleteRecipe(recipeId)
            if (result.error) {
                alert('Error al eliminar: ' + result.error)
            } else {
                // The page will revalidate and update automatically via revalidatePath
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
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
                        Mis Recetas
                        <span className="text-xs font-mono font-normal bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full">
                            {recipes.length} guardadas
                        </span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {recipes.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                            <AlertTriangle className="w-10 h-10 mb-3 opacity-50" />
                            <p>No tienes recetas guardadas.</p>
                            <p className="text-sm opacity-70">Añade algunas desde el formulario para poder generar menús.</p>
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
