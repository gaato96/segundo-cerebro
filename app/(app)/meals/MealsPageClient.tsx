'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Wand2, RefreshCw, ShoppingCart,
    ChevronLeft, ChevronRight, X, Loader2,
    Clock, Tag, ListChecks
} from 'lucide-react'
import { generateWeeklyMenu, createRecipe } from '@/lib/actions/meals'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { RecipeForm } from './RecipeForm'

interface Recipe {
    id: string
    name: string
    description?: string
    ingredients: any[]
    steps?: string
    complexity: string
}

interface MenuData {
    [key: string]: {
        lunch: { recipe_id: string, name: string }
        dinner: { recipe_id: string, name: string }
    }
}

export default function MealsPageClient({ initialRecipes, initialMenu, startDate }: any) {
    const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes)
    const [menu, setMenu] = useState<any>(initialMenu)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false)
    const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false)

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    async function handleGenerateMenu() {
        setIsLoading(true)
        try {
            const result = await generateWeeklyMenu(startDate)
            setMenu({ menu_data: result.menu, shopping_list: result.shopping_list })
            // toast({ title: 'Menú generado', description: 'Tu plan semanal está listo.' })
        } catch (error: any) {
            alert(error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const selectedRecipeId = selectedDay && menu?.menu_data?.[selectedDay]?.lunch?.recipe_id
    const selectedRecipe = recipes.find(r => r.id === selectedRecipeId)

    return (
        <div className="space-y-8">
            {/* Action Bar */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAddRecipeOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Receta
                    </button>
                    <button
                        onClick={handleGenerateMenu}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl transition-all font-medium text-sm shadow-lg shadow-indigo-500/20"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Wand2 className="w-4 h-4" />
                        )}
                        {menu ? 'Regenerar con IA' : 'Magic Generate'}
                    </button>
                </div>

                {menu?.shopping_list && (
                    <button className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 rounded-xl transition-colors text-sm">
                        <ShoppingCart className="w-4 h-4 text-indigo-400" />
                        Ver Lista de Compras ({menu.shopping_list.length})
                    </button>
                )}

                <AnimatePresence>
                    {isAddRecipeOpen && (
                        <RecipeForm onClose={() => setIsAddRecipeOpen(false)} />
                    )}
                </AnimatePresence>
            </div>

            {/* Weekly Grid */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {days.map((day) => {
                    const dayData = menu?.menu_data?.[day]
                    return (
                        <div key={day} className="flex flex-col gap-3">
                            <h3 className="font-heading font-semibold text-center text-sm text-muted-foreground uppercase tracking-wider">
                                {format(addDays(new Date(startDate), days.indexOf(day)), 'EEEE', { locale: es })}
                            </h3>

                            <div className="space-y-3">
                                {/* Almuerzo */}
                                <MealCard
                                    type="Almuerzo"
                                    recipe={dayData?.lunch}
                                    onClick={() => setSelectedDay(day)}
                                />
                                {/* Cena */}
                                <MealCard
                                    type="Cena"
                                    recipe={dayData?.dinner}
                                    onClick={() => setSelectedDay(day)}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Recipe Modal */}
            <AnimatePresence>
                {selectedDay && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1b26] border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 relative"
                        >
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-3xl font-heading font-bold mb-2">Detalles del Día</h2>
                                    <p className="text-indigo-400 font-medium">
                                        {format(addDays(new Date(startDate), days.indexOf(selectedDay)), "EEEE d 'de' MMMM", { locale: es })}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <RecipeSection title="Almuerzo" recipeData={menu.menu_data[selectedDay].lunch} recipes={recipes} />
                                    <RecipeSection title="Cena" recipeData={menu.menu_data[selectedDay].dinner} recipes={recipes} />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {!menu && !isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 glass rounded-3xl border-dashed border-2 border-white/10">
                    <div className="p-4 rounded-full bg-indigo-600/10 text-indigo-400">
                        <Wand2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-heading font-bold">Tu plan está vacío</h3>
                        <p className="text-muted-foreground">Usa el botón Magic Generate para que la IA organice tu semana.</p>
                    </div>
                </div>
            )}
        </div>
    )
}

function MealCard({ type, recipe, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="w-full text-left glass hover:border-indigo-500/50 p-4 rounded-2xl transition-all group"
        >
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-2">{type}</span>
            {recipe ? (
                <div>
                    <h4 className="font-heading font-bold text-sm group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {recipe.name}
                    </h4>
                </div>
            ) : (
                <span className="text-xs text-muted-foreground italic">Sin asignar</span>
            )}
        </button>
    )
}

function RecipeSection({ title, recipeData, recipes }: any) {
    const recipe = recipes.find((r: any) => r.id === recipeData.recipe_id)

    if (!recipe) return (
        <div className="space-y-2">
            <h3 className="font-heading font-bold text-lg">{title}</h3>
            <p className="text-muted-foreground italic text-sm">No se encontró información de la receta.</p>
        </div>
    )

    return (
        <div className="space-y-4">
            <h3 className="font-heading font-bold text-xl flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                {title}: {recipe.name}
            </h3>

            <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    {recipe.complexity}
                </div>
                {recipe.protein_type && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg">
                        <Tag className="w-3 h-3" />
                        {recipe.protein_type}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Ingredientes</h4>
                <ul className="space-y-1">
                    {recipe.ingredients.map((ing: any, i: number) => (
                        <li key={i} className="text-sm flex justify-between border-b border-white/5 pb-1">
                            <span>{ing.item}</span>
                            <span className="text-indigo-400 font-medium">{ing.amount} {ing.unit}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {recipe.steps && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Pasos</h4>
                    <p className="text-sm text-sidebar-foreground/80 leading-relaxed">
                        {recipe.steps}
                    </p>
                </div>
            )}
        </div>
    )
}
