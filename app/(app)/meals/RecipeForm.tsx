'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, X } from 'lucide-react'
import { createRecipe } from '@/lib/actions/meals'

export function RecipeForm({ onClose }: { onClose: () => void }) {
    const [ingredients, setIngredients] = useState([{ item: '', amount: '', unit: '' }])
    const [isSaving, setIsSaving] = useState(false)

    const addIngredient = () => {
        setIngredients([...ingredients, { item: '', amount: '', unit: '' }])
    }

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index))
    }

    const updateIngredient = (index: number, field: string, value: string) => {
        const newIngredients = [...ingredients]
        newIngredients[index] = { ...newIngredients[index], [field]: value }
        setIngredients(newIngredients)
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsSaving(true)

        try {
            const formData = new FormData(e.currentTarget)
            formData.append('ingredients', JSON.stringify(ingredients.filter(i => i.item)))
            await createRecipe(formData)
            onClose()
        } catch (error: any) {
            alert('Error al guardar la receta: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-3xl font-heading font-bold mb-6">Nueva Receta</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Nombre del Plato</label>
                            <input
                                name="name"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Ej: Milanesa con puré"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Complejidad</label>
                                <select name="complexity" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none">
                                    <option value="Fast">Rápida</option>
                                    <option value="Medium" selected>Media</option>
                                    <option value="Complex">Compleja</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Proteína Principal</label>
                                <input name="protein_type" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="Ej: Pollo" />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Carbohidrato</label>
                                <input name="carb_type" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="Ej: Papa" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Ingredientes</label>
                            <div className="space-y-2">
                                {ingredients.map((ing, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            value={ing.item}
                                            onChange={(e) => updateIngredient(index, 'item', e.target.value)}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                                            placeholder="Ingrediente"
                                        />
                                        <input
                                            value={ing.amount}
                                            onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                                            className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                                            placeholder="Cant."
                                        />
                                        <input
                                            value={ing.unit}
                                            onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                                            className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                                            placeholder="Ud."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeIngredient(index)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addIngredient}
                                    className="text-indigo-400 text-sm font-medium flex items-center gap-1 hover:text-indigo-300"
                                >
                                    <Plus className="w-4 h-4" /> Añadir ingrediente
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest block mb-2">Pasos / Instrucciones</label>
                            <textarea
                                name="steps"
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none resize-none"
                                placeholder="Escribe los pasos aquí..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                        >
                            {isSaving ? 'Guardando...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Guardar Receta
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
