'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Sparkles, Loader2, UserCog, TreePine, Trophy } from 'lucide-react'
import { TrainingProfileForm } from '@/components/training/TrainingProfileForm'
import { TrainingPlanView } from '@/components/training/TrainingPlanView'
import { ParkPlanView } from '@/components/training/ParkPlanView'
import { MatchTracker } from '@/components/training/MatchTracker'
import { generateTrainingPlan } from '@/lib/actions/training'
import type { PlanProgress } from '@/lib/trainingProgress'
import type { ParkProgress } from '@/lib/parkPlan'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState } from '@/components/ui/kit'
import { Segmented, Bar } from '@/components/ui/controls'
import { LineChart } from '@/components/ui/LineChart'

type Tab = 'fuerza' | 'parque' | 'partidos'

export function EntrenamientoPageClient({ profile, plan, logs, progress, parkLogs, parkProgress, matches, weekSummary, weights, goalWeight }: {
    profile: any; plan: any; logs: any[]; progress: PlanProgress; parkLogs: any[] | null; parkProgress: ParkProgress; matches: any[] | null
    weekSummary: { strength: number; park: number; matches: number }; weights: { label: string; value: number }[]; goalWeight: number | null
}) {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('fuerza')
    const [editing, setEditing] = useState(!profile)
    const [generating, setGenerating] = useState(false)
    const week = weekSummary.strength + weekSummary.park + weekSummary.matches
    const last = weights[weights.length - 1]
    const doneTotal = logs.filter(l => l.completed).length
    const total = (plan?.plan_data?.weeks || []).reduce((n: number, w: any) => n + w.days.length, 0)

    async function generate() {
        if (plan && !confirm('Ya tenés un plan activo. Si generás uno nuevo, el actual se archiva. ¿Seguimos?')) return
        setGenerating(true)
        try { await generateTrainingPlan(); router.refresh() } catch (e: any) { alert(`No se pudo generar el plan: ${e?.message}`) } finally { setGenerating(false) }
    }

    return (
        <PageShell wide>
            <PageHeader label={plan ? `Cuerpo · semana ${progress.currentWeek} de ${progress.totalWeeks}` : 'Cuerpo'} title="Entrenamiento" subtitle="Fuerza en casa, aire y piques en el parque, y tus partidos."
                actions={tab === 'fuerza' ? <><button onClick={() => setEditing(v => !v)} className="btn-secondary text-sm"><UserCog className="w-4 h-4" /> {editing ? 'Cerrar perfil' : 'Perfil'}</button>{profile && plan && <button onClick={generate} disabled={generating} className="btn-secondary text-sm">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Plan nuevo</button>}</> : undefined} />
            <Segmented className="mb-6" value={tab} onChange={setTab} options={[{ id: 'fuerza', label: 'Fuerza en casa', icon: Dumbbell }, { id: 'parque', label: 'Parque', icon: TreePine }, { id: 'partidos', label: 'Partidos', icon: Trophy }]} />
            {tab !== 'fuerza' && (parkLogs === null || matches === null) && <p className="mb-5 rounded-xl border border-hairline px-4 py-3 text-sm">Para guardar parque y partidos falta correr la migración 023 en Supabase.</p>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0">
                    {tab === 'parque' && <ParkPlanView logs={parkLogs || []} progress={parkProgress} />}
                    {tab === 'partidos' && <MatchTracker matches={matches || []} />}
                    {tab === 'fuerza' && (editing ? <TrainingProfileForm initial={profile} onSaved={() => { setEditing(false); router.refresh() }} />
                        : plan ? <TrainingPlanView plan={plan} logs={logs} progress={progress} />
                            : <EmptyState icon={Dumbbell} title="Todavía no tenés plan" hint="Se arman 12 semanas con progresión, descargas y soga, según tu perfil." action={<button onClick={generate} disabled={generating || !profile} className="btn-primary text-sm">{generating && <Loader2 className="w-4 h-4 animate-spin" />} Generar mi plan</button>} />)}
                </div>
                <aside className="lg:col-span-4 min-w-0 space-y-4">
                    <Panel>
                        <SectionLabel right={`${week} de 4`}>Esta semana</SectionLabel>
                        <Bar pct={(week / 4) * 100} tone={week >= 4 ? 'good' : 'neutral'} />
                        <dl className="mt-3 divide-y divide-hairline text-sm">{([['Fuerza', weekSummary.strength], ['Parque', weekSummary.park], ['Partidos', weekSummary.matches]] as [string, number][]).map(([l, v]) => <div key={l} className="flex justify-between py-2"><dt className="text-muted-foreground">{l}</dt><dd className="font-mono">{v}</dd></div>)}</dl>
                        {week === 0 && <p className="text-sm text-muted-foreground">Hoy alcanza con 10 minutos.</p>}
                    </Panel>
                    <Panel>
                        <SectionLabel>Peso</SectionLabel>
                        {last && <p className="font-mono text-3xl mb-3">{last.value} <span className="text-sm text-muted-foreground">kg{goalWeight ? ` · meta ${goalWeight}` : ''}</span></p>}
                        <LineChart points={weights.slice(-12)} goal={goalWeight} unit="kg" />
                        <a href="/meals/nutrition?tab=progress" className="text-xs text-muted-foreground hover:text-foreground min-h-[36px] inline-flex items-center mt-1">Registrar peso</a>
                    </Panel>
                    {total > 0 && <Panel><SectionLabel right={`${doneTotal}/${total}`}>Plan completo</SectionLabel><Bar pct={(doneTotal / total) * 100} tone="good" /></Panel>}
                </aside>
            </div>
        </PageShell>
    )
}
