'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Loader2, Sparkles, Scale, Ruler, Activity, Target, AlertCircle, X } from 'lucide-react'
import { saveNutritionProfile } from '@/lib/actions/nutrition'

interface NutritionProfileFormProps {
    initialProfile?: any
    onSuccess?: () => void
}

export function NutritionProfileForm({ initialProfile, onSuccess }: NutritionProfileFormProps) {
    const [weight, setWeight] = useState(initialProfile?.weight_kg || 75)
    const [height, setHeight] = useState(initialProfile?.height_cm || 175)
    const [age, setAge] = useState(initialProfile?.age || 28)
    const [sex, setSex] = useState<'male' | 'female'>(initialProfile?.sex || 'male')
    const [activityLevel, setActivityLevel] = useState(initialProfile?.activity_level || 'moderate')
    const [goal, setGoal] = useState(initialProfile?.goal || 'lose_weight')
    const [dislikedText, setDislikedText] = useState((initialProfile?.disliked_ingredients || []).join(', '))
    const [customNotes, setCustomNotes] = useState(initialProfile?.custom_notes || '')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        const dislikedArray = dislikedText
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)

        try {
            await saveNutritionProfile({
                weight_kg: Number(weight),
                height_cm: Number(height),
                age: Number(age),
                sex,
                activity_level: activityLevel as any,
                goal: goal as any,
                disliked_ingredients: dislikedArray,
                custom_notes: customNotes,
                province: 'Tucumán'
            })
            onSuccess?.()
        } catch (error) {
            console.error('Error al guardar perfil:', error)
            alert('Error al guardar el perfil nutricional')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="glass p-6 md:p-8 rounded-2xl border border-emerald-500/20 shadow-xl space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-heading font-bold text-foreground">Tu Perfil Nutricional</h2>
                    <p className="text-xs text-muted-foreground">Datos requeridos para que la IA calcule tus calorías y arme tu dieta adaptada a Tucumán</p>
                </div>
            </div>

            {/* Basic Physical Data */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-emerald-400" /> Peso (kg)
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        required
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-emerald-400" /> Altura (cm)
                    </label>
                    <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        required
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1">Edad</label>
                    <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        required
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1">Sexo</label>
                    <select
                        value={sex}
                        onChange={(e) => setSex(e.target.value as any)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                        <option value="male">Masculino</option>
                        <option value="female">Femenino</option>
                    </select>
                </div>
            </div>

            {/* Activity & Goal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" /> Actividad Física
                    </label>
                    <select
                        value={activityLevel}
                        onChange={(e) => setActivityLevel(e.target.value as any)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                        <option value="sedentary">🛋️ Sedentario (Oficina / Casi sin ejercicio)</option>
                        <option value="light">🚶 Ligeramente activo (1-2 días/sem)</option>
                        <option value="moderate">🏃 Moderadamente activo (3-5 días/sem)</option>
                        <option value="active">🏋️ Muy activo (6-7 días/sem)</option>
                        <option value="very_active">⚡ Atleta / Trabajo físico pesado</option>
                    </select>
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5 text-emerald-400" /> Objetivo Principal
                    </label>
                    <select
                        value={goal}
                        onChange={(e) => setGoal(e.target.value as any)}
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                        <option value="lose_weight">🔥 Descenso de peso y grasa corporal</option>
                        <option value="maintain">⚖️ Mantenimiento y salud general</option>
                        <option value="gain_muscle">💪 Aumento de masa muscular (Hipertrofia)</option>
                    </select>
                </div>
            </div>

            {/* Disliked Ingredients */}
            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Alimentos / Ingredientes que NO te gustan</span>
                    <span className="text-[10px] text-muted-foreground/60">Separados por coma</span>
                </label>
                <input
                    type="text"
                    value={dislikedText}
                    onChange={(e) => setDislikedText(e.target.value)}
                    placeholder="Ej. mondongo, pescado, berenjenas, pasas de uva..."
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
            </div>

            {/* Custom Lifestyle & Schedule Notes */}
            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Contexto Personal, Horarios y Restricciones Específicas</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">✨ La IA lo respetará al 100%</span>
                </label>
                <textarea
                    rows={3}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Ej: Me levanto a las 5:00 AM, tengo un hijo de 2 años y poco tiempo. No puedo comer más de 2 huevos al día por presupuesto. Prefiero comidas rápidas y económicas..."
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
            </div>

            {/* Location Notice */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Ubicación predeterminada: <strong>San Miguel de Tucumán</strong>. Las comidas sugeridas se conseguirán fácilmente en la zona.</span>
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Guardar Perfil y Calcular Plan
            </button>
        </form>
    )
}
