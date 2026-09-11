'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dumbbell, Sparkles, Loader2, UserCog, ArrowLeft, CalendarRange } from 'lucide-react'
import { TrainingProfileForm } from '@/components/training/TrainingProfileForm'
import { TrainingPlanView } from '@/components/training/TrainingPlanView'
import { generateTrainingPlan } from '@/lib/actions/training'

interface Props {
    profile: any
    plan: any
    logs: any[]
    currentWeek: number
}

export function EntrenamientoPageClient({ profile, plan, logs, currentWeek }: Props) {
    const router = useRouter()
    const [editingProfile, setEditingProfile] = useState(!profile)
    const [generating, setGenerating] = useState(false)

    async function handleGenerate() {
        if (plan && !confirm('Ya tenés un plan activo. Si generás uno nuevo, el actual se archiva. ¿Seguimos?')) return
        setGenerating(true)
        try {
            await generateTrainingPlan()
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo generar el plan: ${e?.message}`)
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/meals/nutrition" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" /> Nutricionista IA
                        </Link>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Plan de entrenamiento</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        12 semanas periodizadas, con ejercicios distintos cada semana y tu equipamiento real.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setEditingProfile(v => !v)}
                        className="px-3.5 py-2 glass hover:bg-secondary/60 border border-border/50 text-xs font-semibold text-foreground rounded-xl transition-all flex items-center gap-1.5"
                    >
                        <UserCog className="w-4 h-4 text-emerald-400" />
                        {editingProfile ? 'Cerrar perfil' : 'Perfil'}
                    </button>
                    {profile && (
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                        >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {plan ? 'Generar nuevo plan' : 'Generar plan de 3 meses'}
                        </button>
                    )}
                </div>
            </div>

            {editingProfile && (
                <TrainingProfileForm
                    initial={profile}
                    onSaved={() => {
                        setEditingProfile(false)
                        router.refresh()
                    }}
                />
            )}

            {!editingProfile && !plan && (
                <div className="glass p-8 rounded-2xl border border-dashed border-emerald-500/30 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                        <Dumbbell className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-base font-heading font-bold text-foreground">Todavía no tenés plan</h3>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1.5 leading-relaxed">
                            Se generan 12 semanas completas de una: 3 bloques de progresión, semanas de descarga,
                            entrada en calor y vuelta a la calma, y la soga con intervalos que van subiendo.
                            Los ejercicios rotan todas las semanas dentro del mismo patrón de movimiento.
                        </p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !profile}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarRange className="w-4 h-4" />}
                        {generating ? 'Armando las 12 semanas…' : 'Generar mi plan'}
                    </button>
                </div>
            )}

            {!editingProfile && plan && (
                <TrainingPlanView plan={plan} logs={logs} currentWeek={currentWeek} />
            )}
        </div>
    )
}
