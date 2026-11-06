'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dumbbell, Sparkles, Loader2, UserCog, ArrowLeft, CalendarRange, TreePine, Trophy, AlertTriangle } from 'lucide-react'
import { TrainingProfileForm } from '@/components/training/TrainingProfileForm'
import { TrainingPlanView } from '@/components/training/TrainingPlanView'
import { ParkPlanView } from '@/components/training/ParkPlanView'
import { MatchTracker } from '@/components/training/MatchTracker'
import { generateTrainingPlan } from '@/lib/actions/training'
import type { PlanProgress } from '@/lib/trainingProgress'
import type { ParkProgress } from '@/lib/parkPlan'
import { cn } from '@/lib/utils'

interface Props {
    profile: any
    plan: any
    logs: any[]
    progress: PlanProgress
    /** null = la migración 023 todavía no corrió */
    parkLogs: any[] | null
    parkProgress: ParkProgress
    matches: any[] | null
    weekSummary: { strength: number; park: number; matches: number }
}

type Tab = 'fuerza' | 'parque' | 'partidos'

const TABS: { id: Tab; label: string; icon: any; active: string }[] = [
    { id: 'fuerza', label: 'Fuerza en casa', icon: Dumbbell, active: 'bg-emerald-600 border-emerald-500' },
    { id: 'parque', label: 'Parque', icon: TreePine, active: 'bg-lime-600 border-lime-500' },
    { id: 'partidos', label: 'Partidos', icon: Trophy, active: 'bg-sky-600 border-sky-500' }
]

export function EntrenamientoPageClient({ profile, plan, logs, progress, parkLogs, parkProgress, matches, weekSummary }: Props) {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('fuerza')
    const missingMigration = parkLogs === null || matches === null
    const weekTotal = weekSummary.strength + weekSummary.park + weekSummary.matches
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
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Entrenamiento</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Fuerza en casa, aire y piques en el parque, y tus partidos para ver si mejorás.
                    </p>
                </div>

                {tab === 'fuerza' && <div className="flex items-center gap-2 shrink-0">
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
                </div>}
            </div>

            {/* Esta semana, sumando los tres frentes */}
            <div className="glass p-3.5 rounded-2xl border border-border/50 flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Esta semana</span>
                <WeekStat icon={Dumbbell} color="text-emerald-400" value={weekSummary.strength} label="fuerza" />
                <WeekStat icon={TreePine} color="text-lime-400" value={weekSummary.park} label="parque" />
                <WeekStat icon={Trophy} color="text-sky-400" value={weekSummary.matches} label={weekSummary.matches === 1 ? 'partido' : 'partidos'} />
                <span className="text-[11px] text-muted-foreground ml-auto">
                    {weekTotal === 0
                        ? 'Todavía nada. Hoy alcanza con 10 minutos.'
                        : weekTotal >= 4
                            ? 'Semana completa. Así se vuelve.'
                            : `${weekTotal} de 4 · alterná fuerza y parque, y el partido suma.`}
                </span>
            </div>

            {/* Pestañas */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all',
                            tab === t.id ? `${t.active} text-white` : 'glass border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {tab !== 'fuerza' && missingMigration && (
                <div className="glass p-3.5 rounded-2xl border border-amber-500/30 bg-amber-950/10 flex items-start gap-2.5 text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">
                        <strong className="text-foreground">Falta un paso:</strong> corré la migración
                        <code className="mx-1 text-amber-300">023_park_plan_football_matches.sql</code>
                        en el SQL Editor de Supabase para poder guardar sesiones de parque y partidos.
                    </p>
                </div>
            )}

            {tab === 'parque' && <ParkPlanView logs={parkLogs || []} progress={parkProgress} />}
            {tab === 'partidos' && <MatchTracker matches={matches || []} />}

            {tab === 'fuerza' && editingProfile && (
                <TrainingProfileForm
                    initial={profile}
                    onSaved={() => {
                        setEditingProfile(false)
                        router.refresh()
                    }}
                />
            )}

            {tab === 'fuerza' && !editingProfile && !plan && (
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

            {tab === 'fuerza' && !editingProfile && plan && (
                <TrainingPlanView plan={plan} logs={logs} progress={progress} />
            )}
        </div>
    )
}

function WeekStat({ icon: Icon, color, value, label }: { icon: any; color: string; value: number; label: string }) {
    return (
        <span className="flex items-center gap-1.5 text-xs">
            <Icon className={cn('w-3.5 h-3.5', color)} />
            <strong className="text-foreground">{value}</strong>
            <span className="text-muted-foreground">{label}</span>
        </span>
    )
}
