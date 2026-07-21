'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, PlusCircle, Check, BookOpen, Clock, Tag } from 'lucide-react'
import { getRecipeRecommendations, createRecipe } from '@/lib/actions/meals'

export function RecipeRecommenderWidget() {
    const [recs, setRecs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [importing, setImporting] = useState<Record<string, boolean>>({})

    const loadRecommendations = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await getRecipeRecommendations()
            if (res.error) {
                setError(res.error)
            } else if (res.data?.recommendations) {
                setRecs(res.data.recommendations)
            }
        } catch (e: any) {
            setError('Error cargando sugerencias: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadRecommendations()
    }, [])

    const handleImport = async (recipe: any, index: number) => {
        setImporting(prev => ({ ...prev, [index.toString()]: true }))
        try {
            // Build FormData matching the backend action expects
            const formData = new FormData()
            formData.append('name', recipe.name)
            formData.append('description', recipe.description || '')
            formData.append('complexity', recipe.complexity || 'Medium')
            formData.append('protein_type', recipe.protein_type || '')
            formData.append('carb_type', recipe.carb_type || '')
            formData.append('steps', recipe.steps || '')
            formData.append('ingredients', JSON.stringify(recipe.ingredients || []))
            formData.append('tags', (recipe.tags || []).join(', '))

            await createRecipe(formData)
            
            // Set as imported
            setImporting(prev => ({ ...prev, [index.toString()]: false }))
            // Modify recipe to show imported state
            setRecs(prev => prev.map((r, i) => i === index ? { ...r, imported: true } : r))
        } catch (e: any) {
            alert('Error al guardar la receta: ' + e.message)
            setImporting(prev => ({ ...prev, [index.toString()]: false }))
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-heading font-bold text-lg text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                    Sugerencias de Recetas con IA
                </h3>
                <button
                    onClick={loadRecommendations}
                    disabled={loading}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors disabled:opacity-50"
                >
                    {loading ? 'Generando...' : 'Obtener nuevas sugerencias'}
                </button>
            </div>

            {loading ? (
                <div className="glass p-12 rounded-3xl border border-border/50 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-sm text-muted-foreground">La IA está diseñando recetas exclusivas para ti...</p>
                </div>
            ) : error ? (
                <div className="glass p-8 text-center rounded-3xl border border-red-500/10 text-red-400 space-y-3">
                    <p className="text-sm">{error}</p>
                    <button onClick={loadRecommendations} className="px-4 py-2 bg-secondary rounded-xl text-xs text-white">Reintentar</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recs.map((recipe, index) => (
                        <div key={index} className="glass p-5 rounded-3xl border border-border/50 bg-secondary/5 flex flex-col justify-between hover:bg-secondary/10 transition-all">
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-heading font-bold text-base text-white">{recipe.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{recipe.description}</p>
                                </div>

                                <div className="flex gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                        {recipe.complexity === 'Fast' ? 'Rápida' : recipe.complexity === 'Complex' ? 'Compleja' : 'Media'}
                                    </span>
                                    {recipe.protein_type && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                                            {recipe.protein_type}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ingredientes:</span>
                                    <p className="text-xs text-white/80 line-clamp-2">
                                        {recipe.ingredients?.map((i: any) => i.item).join(', ')}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 mt-4 border-t border-white/5 flex gap-2">
                                {recipe.imported ? (
                                    <div className="w-full py-2 bg-green-500/10 border border-green-500/20 text-green-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1">
                                        <Check className="w-4 h-4" />
                                        Guardado en Recetas
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleImport(recipe, index)}
                                        disabled={importing[index.toString()]}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow shadow-indigo-600/15"
                                    >
                                        {importing[index.toString()] ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <PlusCircle className="w-3.5 h-3.5" />
                                        )}
                                        Añadir a Mis Recetas
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
