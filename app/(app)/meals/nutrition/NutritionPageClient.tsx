'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Utensils, MessageSquare, TrendingUp, Dumbbell, UserCheck, Scale, ArrowLeft } from 'lucide-react'
import { NutritionProfileForm } from '@/components/nutrition/NutritionProfileForm'
import { NutritionDashboard } from '@/components/nutrition/NutritionDashboard'
import { MonthlyPlanView } from '@/components/nutrition/MonthlyPlanView'
import { ProgressTracker } from '@/components/nutrition/ProgressTracker'
import { ExerciseRoutine } from '@/components/nutrition/ExerciseRoutine'
import { NutritionChat } from '@/components/nutrition/NutritionChat'
import { generateMonthlyPlan } from '@/lib/actions/nutrition'
import Link from 'next/link'

interface NutritionPageClientProps {
    initialProfile: any
    initialPlan: any
    initialProgress: any[]
    initialChat: any[]
    currentMonth: string
}

export function NutritionPageClient({
    initialProfile,
    initialPlan,
    initialProgress,
    initialChat,
    currentMonth
}: NutritionPageClientProps) {
    const [profile, setProfile] = useState(initialProfile)
    const [plan, setPlan] = useState(initialPlan)
    const [progressHistory, setProgressHistory] = useState(initialProgress)
    const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'progress' | 'exercise' | 'chat'>(
        initialProfile ? 'dashboard' : 'profile' as any
    )
    const [editingProfile, setEditingProfile] = useState(!initialProfile)
    const [generating, setGenerating] = useState(false)

    async function handleGeneratePlan() {
        setGenerating(true)
        try {
            const newPlan = await generateMonthlyPlan(currentMonth)
            setPlan(newPlan)
            setActiveTab('plan')
        } catch (err: any) {
            console.error(err)
            alert(`Error al generar el plan: ${err?.message || 'Reintentá en unos momentos.'}`)
        } finally {
            setGenerating(false)
        }
    }

    if (editingProfile || !profile) {
        return (
            <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <Link
                        href="/meals"
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a Comidas
                    </Link>
                </div>
                <NutritionProfileForm
                    initialProfile={profile}
                    onSuccess={() => {
                        setEditingProfile(false)
                        window.location.reload()
                    }}
                />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in relative pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/meals" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" /> Planificador de Comidas
                        </Link>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-xs font-semibold text-emerald-400">Nutrición IA</span>
                    </div>
                    <h1 className="text-3xl font-heading font-bold gradient-text">Asistente Nutricionista</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Tu plan mensual inteligente y seguimiento personalizado para Tucumán
                    </p>
                </div>

                <button
                    onClick={() => setEditingProfile(true)}
                    className="px-3.5 py-2 glass hover:bg-secondary/60 border border-border/50 text-xs font-semibold text-foreground rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Editar Perfil Nutricional
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
                {[
                    { id: 'dashboard', label: 'Panel', icon: Sparkles },
                    { id: 'plan', label: 'Mi Plan Mensual', icon: Utensils },
                    { id: 'progress', label: 'Progreso', icon: TrendingUp },
                    { id: 'exercise', label: 'Ejercicio (15m)', icon: Dumbbell },
                    { id: 'chat', label: 'Chat Nutricionista', icon: MessageSquare }
                ].map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-1 min-w-[120px] ${
                                isActive
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Views */}
            {activeTab === 'dashboard' && (
                <NutritionDashboard
                    profile={profile}
                    onGeneratePlan={handleGeneratePlan}
                    generating={generating}
                />
            )}

            {activeTab === 'plan' && (
                <MonthlyPlanView
                    plan={plan}
                />
            )}

            {activeTab === 'progress' && (
                <ProgressTracker
                    history={progressHistory}
                    onAdded={() => {
                        window.location.reload()
                    }}
                />
            )}

            {activeTab === 'exercise' && (
                <ExerciseRoutine exercisePlan={plan?.exercise_plan} />
            )}

            {activeTab === 'chat' && (
                <NutritionChat initialMessages={initialChat} />
            )}
        </div>
    )
}
