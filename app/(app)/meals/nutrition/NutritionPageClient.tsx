'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, UserCheck } from 'lucide-react'
import { NutritionProfileForm } from '@/components/nutrition/NutritionProfileForm'
import { MonthlyPlanView } from '@/components/nutrition/MonthlyPlanView'
import { ProgressTracker } from '@/components/nutrition/ProgressTracker'
import { ExerciseRoutine } from '@/components/nutrition/ExerciseRoutine'
import { NutritionChat } from '@/components/nutrition/NutritionChat'
import { generateMonthlyPlan } from '@/lib/actions/nutrition'
import { ModuleTabs } from '@/components/layout/ModuleTabs'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'
import { Segmented, StatStrip } from '@/components/ui/controls'
import { LineChart } from '@/components/ui/LineChart'

type Tab = 'plan' | 'progress' | 'exercise'
const GOAL: Record<string, string> = { lose_weight: 'Bajar de peso', maintain: 'Mantenimiento', gain_muscle: 'Ganar músculo' }

export function NutritionPageClient({ initialProfile: profile, initialPlan, initialProgress, initialChat, currentMonth, initialTab }: {
    initialProfile: any; initialPlan: any; initialProgress: any[]; initialChat: any[]; currentMonth: string; initialTab: Tab
}) {
    const router = useRouter()
    const [plan, setPlan] = useState(initialPlan)
    const [tab, setTab] = useState<Tab>(initialTab)
    const [editing, setEditing] = useState(!profile)
    const [generating, setGenerating] = useState(false)
    useEffect(() => { setPlan(initialPlan) }, [initialPlan])

    async function generate() {
        if (plan && !confirm('Esto reemplaza el plan de este mes. ¿Seguimos?')) return
        setGenerating(true)
        try { setPlan(await generateMonthlyPlan(currentMonth)); setTab('plan') } catch (e: any) { alert(`No se pudo generar: ${e?.message || 'reintentá en unos momentos.'}`) } finally { setGenerating(false) }
    }
    if (editing || !profile) return (
        <PageShell className="max-w-[760px]">
            <PageHeader label="Cuerpo" title="Perfil nutricional" subtitle="Con esto se calculan tus calorías y macros." actions={profile ? <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Volver</button> : undefined} />
            <NutritionProfileForm initialProfile={profile} onSuccess={() => { setEditing(false); router.refresh() }} />
        </PageShell>
    )
    const weights = initialProgress.filter(h => Number(h.weight_kg) > 0).map(h => ({ label: `${String(h.date).slice(8, 10)}/${String(h.date).slice(5, 7)}`, value: Number(h.weight_kg) }))

    return (
        <PageShell wide>
            <PageHeader label={`Cuerpo · ${GOAL[profile.goal] || profile.goal}`} title="Nutrición" subtitle="Tu plan del mes y el nutricionista, en una sola pantalla."
                actions={<><ModuleTabs module="nutricion" /><button onClick={() => setEditing(true)} className="btn-secondary text-sm"><UserCheck className="w-4 h-4" /> Perfil</button><button onClick={generate} disabled={generating} className={plan ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {plan ? 'Regenerar' : 'Generar plan'}</button></>} />
            <div className="mb-6"><StatStrip items={[
                { label: 'Energía diaria', value: `${profile.target_calories} kcal`, hint: `gastás unas ${profile.tdee_calories}` },
                { label: 'Proteína', value: `${profile.target_protein_g} g` }, { label: 'Carbos', value: `${profile.target_carbs_g} g` }, { label: 'Grasas', value: `${profile.target_fat_g} g` }, { label: 'Agua', value: `${profile.water_liters} L`, hint: `${Math.round(profile.water_liters * 4)} vasos` }
            ]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0 space-y-5">
                    <Segmented value={tab} onChange={setTab} options={[{ id: 'plan', label: 'Plan del mes' }, { id: 'progress', label: 'Progreso' }, { id: 'exercise', label: 'Rutina corta' }]} />
                    {tab === 'plan' && <MonthlyPlanView plan={plan} />}
                    {tab === 'progress' && <ProgressTracker history={initialProgress} onAdded={() => router.refresh()} />}
                    {tab === 'exercise' && <ExerciseRoutine exercisePlan={plan?.exercise_plan} />}
                </div>
                <aside className="lg:col-span-4 min-w-0 space-y-4">
                    <NutritionChat initialMessages={initialChat} />
                    {weights.length > 0 && <Panel><SectionLabel right={`${weights[weights.length - 1].value} kg`}>Peso</SectionLabel><LineChart points={weights.slice(-12)} unit="kg" /></Panel>}
                    {profile.supplements_recommended?.length > 0 && <Panel><SectionLabel>Suplementos sugeridos</SectionLabel><ul className="divide-y divide-hairline text-sm">{profile.supplements_recommended.map((s: string) => <li key={s} className="py-2">{s}</li>)}</ul></Panel>}
                </aside>
            </div>
        </PageShell>
    )
}
