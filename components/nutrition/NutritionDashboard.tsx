'use client'

import { motion } from 'framer-motion'
import { Flame, Droplets, Dumbbell, Sparkles, Calendar, Scale, Award, HeartHandshake, Pill } from 'lucide-react'

interface NutritionDashboardProps {
    profile: any
    onGeneratePlan: () => void
    generating: boolean
}

export function NutritionDashboard({ profile, onGeneratePlan, generating }: NutritionDashboardProps) {
    if (!profile) return null

    const goalLabels: Record<string, string> = {
        lose_weight: 'Descenso de peso & grasa',
        maintain: 'Mantenimiento & salud',
        gain_muscle: 'Aumento de masa muscular'
    }

    return (
        <div className="space-y-6">
            {/* Bento Top Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Calories Card */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="glass p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-secondary/30 relative overflow-hidden flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Objetivo Calórico</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Flame className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="my-4">
                        <div className="text-4xl font-heading font-extrabold text-foreground">{profile.target_calories} <span className="text-sm font-normal text-muted-foreground">kcal/día</span></div>
                        <p className="text-xs text-muted-foreground mt-1">Gasto calórico estimado (TDEE): {profile.tdee_calories} kcal</p>
                    </div>

                    <div className="text-xs font-medium text-emerald-300/80 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit border border-emerald-500/20">
                        {goalLabels[profile.goal] || profile.goal}
                    </div>
                </motion.div>

                {/* Macros Card */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="glass p-6 rounded-2xl border border-border/50 space-y-4 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Distribución de Macros</span>
                        <Award className="w-5 h-5 text-amber-400" />
                    </div>

                    <div className="space-y-2.5">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-foreground">Proteínas</span>
                                <span className="font-bold text-emerald-400">{profile.target_protein_g}g</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full w-[80%]" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-foreground">Carbohidratos</span>
                                <span className="font-bold text-amber-400">{profile.target_carbs_g}g</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full w-[65%]" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-foreground">Grasas Saludables</span>
                                <span className="font-bold text-blue-400">{profile.target_fat_g}g</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full w-[45%]" />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Water & Hydration Card */}
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="glass p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-secondary/30 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Hidratación Recomendada</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Droplets className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="my-4">
                        <div className="text-4xl font-heading font-extrabold text-foreground">{profile.water_liters} <span className="text-sm font-normal text-muted-foreground">L / día</span></div>
                        <p className="text-xs text-muted-foreground mt-1">Aproximadamente {Math.round(profile.water_liters * 4)} vasos de agua de 250ml</p>
                    </div>

                    <div className="text-xs text-blue-300/80 bg-blue-500/10 px-3 py-1.5 rounded-lg w-fit border border-blue-500/20">
                        💧 Mantener agua fresca a mano durante el día en Tucumán
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row: Supplements & Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplements */}
                <div className="glass p-6 rounded-2xl border border-border/50 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Pill className="w-4 h-4 text-emerald-400" />
                        Suplementos Recomendados
                    </h3>
                    <div className="space-y-1.5">
                        {profile.supplements_recommended?.map((supp: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs text-foreground/90 border border-border/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {supp}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Generate Monthly Dieta Action */}
                <div className="glass p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 to-secondary/40 flex flex-col justify-between space-y-4">
                    <div>
                        <h3 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            Generar Plan Nutricional Mensual
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            El nutricionista IA diseñará tu menú completo de 7 días con comidas típicas tucumanas y rutinas de ejercicio de 15 minutos en casa.
                        </p>
                    </div>

                    <button
                        onClick={onGeneratePlan}
                        disabled={generating}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>Generando plan con IA...</>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar / Regenerar Plan Mensual
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
