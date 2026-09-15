'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Moon, CalendarCheck, Loader2, Check, Trophy, Heart, Brain,
    Sparkles, Flame, Scissors, Target, TrendingUp, AlertCircle, Save
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveEveningRitual } from '@/lib/actions/evening_ritual'
import { generateWeeklyReview, saveWeeklyReflection } from '@/lib/actions/weekly_review'
import { CommitmentWidget } from '@/components/commitments/CommitmentWidget'
import { cn } from '@/lib/utils'

interface Props {
    ritual: any
    commitment: any
    tomorrow: any
    commitmentStats: any
    ritualStats: { total: number; streak: number; avgRating: number | null; doneToday: boolean }
    weekStart: string
    weeklyPlan: any
    initialTab: 'dia' | 'semana'
    appDay: { date: string; calendarDate: string; isAfterMidnight: boolean; cutoffHour: number }
}

const RATINGS = [
    { value: 1, emoji: '😞', label: 'Pésimo' },
    { value: 2, emoji: '😕', label: 'Flojo' },
    { value: 3, emoji: '😐', label: 'Normal' },
    { value: 4, emoji: '🙂', label: 'Bueno' },
    { value: 5, emoji: '😄', label: 'Excelente' }
]

export function CierrePageClient({
    ritual, commitment, tomorrow, commitmentStats, ritualStats,
    weekStart, weeklyPlan, initialTab, appDay
}: Props) {
    const router = useRouter()
    const [tab, setTab] = useState<'dia' | 'semana'>(initialTab)

    // --- Cierre del día ---
    const [rating, setRating] = useState<number | null>(ritual?.day_rating || null)
    const [win, setWin] = useState(ritual?.win || '')
    const [gratitude, setGratitude] = useState(ritual?.gratitude || '')
    const [brainDump, setBrainDump] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(Boolean(ritual))

    // --- Revisión semanal ---
    const [review, setReview] = useState<any>(weeklyPlan?.ai_review || null)
    const [generating, setGenerating] = useState(false)
    const [reflection, setReflection] = useState(weeklyPlan?.reflection || '')
    const [weeklyGoals, setWeeklyGoals] = useState(weeklyPlan?.weekly_goals || '')
    const [savingReview, setSavingReview] = useState(false)

    async function handleSaveRitual() {
        setSaving(true)
        try {
            await saveEveningRitual({
                date: appDay.date,
                day_rating: rating,
                win: win.trim() || null,
                gratitude: gratitude.trim() || null,
                brain_dump: brainDump.trim() || null,
                tomorrow_committed: Boolean(tomorrow)
            })
            setBrainDump('')
            setSaved(true)
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo guardar: ${e?.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleGenerateReview() {
        setGenerating(true)
        try {
            const r = await generateWeeklyReview(weekStart)
            if (!r.ok) {
                alert(`No se pudo generar la revisión: ${r.error}`)
                return
            }
            setReview(r.data)
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo generar la revisión: ${e?.message}`)
        } finally {
            setGenerating(false)
        }
    }

    async function handleSaveReflection() {
        setSavingReview(true)
        try {
            await saveWeeklyReflection(weekStart, reflection, weeklyGoals)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setSavingReview(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Cierre</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        El día no termina cuando te acostás: termina cuando lo cerrás.
                    </p>
                </div>
                {ritualStats.streak > 0 && (
                    <div className="flex items-center gap-1.5 text-indigo-400 shrink-0">
                        <Flame className="w-4 h-4" />
                        <span className="text-sm font-bold">{ritualStats.streak}</span>
                        <span className="text-[11px] text-muted-foreground">
                            {ritualStats.streak === 1 ? 'día seguido' : 'días seguidos'}
                        </span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50">
                {[
                    { id: 'dia', label: 'Cierre del día', icon: Moon },
                    { id: 'semana', label: 'Revisión semanal', icon: CalendarCheck }
                ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as 'dia' | 'semana')}
                            className={cn(
                                'flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex-1',
                                active ? 'bg-indigo-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'dia' && (
                <div className="space-y-4">
                    {appDay.isAfterMidnight && (
                        <div className="glass p-3.5 rounded-2xl border border-sky-500/25 bg-sky-500/5 flex items-start gap-2.5">
                            <Moon className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-sky-200/90 leading-relaxed">
                                Son pasadas las 12, pero tu día todavía no cerró: estás cerrando el{' '}
                                <strong className="text-sky-100">
                                    {appDay.date.split('-').reverse().slice(0, 2).join('/')}
                                </strong>. El corte está configurado a las {String(appDay.cutoffHour).padStart(2, '0')}:00 y lo podés cambiar en Ajustes.
                            </p>
                        </div>
                    )}
                    {/* Paso 1: resolver el compromiso de hoy */}
                    <CommitmentWidget
                        today={commitment}
                        tomorrow={tomorrow}
                        stats={commitmentStats}
                        date={appDay.date}
                        isAfterMidnight={appDay.isAfterMidnight}
                    />

                    {/* Paso 2: cómo estuvo el día */}
                    <Card icon={Moon} color="indigo" title="¿Cómo estuvo el día?" hint="Sin pensarlo mucho. La primera que se te viene.">
                        <div className="flex gap-2">
                            {RATINGS.map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => setRating(r.value)}
                                    title={r.label}
                                    className={cn(
                                        'flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-1',
                                        rating === r.value
                                            ? 'bg-indigo-500/15 border-indigo-500/40 scale-105'
                                            : 'bg-secondary/40 border-border/50 hover:border-border opacity-70 hover:opacity-100'
                                    )}
                                >
                                    <span className="text-xl leading-none">{r.emoji}</span>
                                    <span className="text-[9px] text-muted-foreground">{r.label}</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Paso 3: victoria */}
                    <Card icon={Trophy} color="amber" title="Una victoria de hoy" hint="Por chica que sea. Cuenta haber aparecido.">
                        <input
                            value={win}
                            onChange={e => setWin(e.target.value)}
                            placeholder="Hice la entrada en calor aunque no tenía ganas"
                            className={inputCls}
                        />
                    </Card>

                    {/* Paso 4: gratitud */}
                    <Card icon={Heart} color="rose" title="Algo que agradecer" hint="Opcional.">
                        <input
                            value={gratitude}
                            onChange={e => setGratitude(e.target.value)}
                            placeholder="Que Julián durmió toda la noche"
                            className={inputCls}
                        />
                    </Card>

                    {/* Paso 5: vaciado */}
                    <Card icon={Brain} color="violet" title="¿Qué te quedó dando vueltas?" hint="Va directo al inbox para que no lo pienses a las 3 AM.">
                        <textarea
                            rows={3}
                            value={brainDump}
                            onChange={e => setBrainDump(e.target.value)}
                            placeholder="Llamar al contador, revisar el presupuesto del cliente nuevo…"
                            className={cn(inputCls, 'resize-y')}
                        />
                    </Card>

                    <button
                        onClick={handleSaveRitual}
                        disabled={saving}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {saved ? 'Actualizar el cierre' : 'Cerrar el día'}
                    </button>

                    {ritualStats.total > 0 && (
                        <p className="text-[10px] text-muted-foreground text-center">
                            {ritualStats.total} cierres en los últimos 30 días
                            {ritualStats.avgRating ? ` · ánimo promedio ${ritualStats.avgRating}/5` : ''}
                        </p>
                    )}
                </div>
            )}

            {tab === 'semana' && (
                <div className="space-y-4">
                    <div className="glass p-4 rounded-2xl border border-border/50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-foreground">Semana del {weekStart.split('-').reverse().slice(0, 2).join('/')}</h3>
                            <p className="text-[11px] text-muted-foreground">
                                {review ? 'Revisión generada con tus datos reales.' : 'Todavía no revisaste esta semana.'}
                            </p>
                        </div>
                        <button
                            onClick={handleGenerateReview}
                            disabled={generating}
                            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                        >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {review ? 'Regenerar' : 'Generar revisión'}
                        </button>
                    </div>

                    <AnimatePresence>
                        {review && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                {review.titular && (
                                    <div className="glass p-4 rounded-2xl border border-violet-500/25 bg-violet-950/10">
                                        <p className="text-sm font-semibold text-foreground leading-snug">{review.titular}</p>
                                    </div>
                                )}

                                <ReviewList
                                    icon={TrendingUp}
                                    color="emerald"
                                    title="Funcionó"
                                    items={review.funciono}
                                />
                                <ReviewList
                                    icon={AlertCircle}
                                    color="red"
                                    title="No funcionó"
                                    items={review.no_funciono}
                                />

                                {review.patron && (
                                    <div className="glass p-4 rounded-2xl border border-amber-500/25 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                            El patrón
                                        </span>
                                        <p className="text-xs text-foreground/90 leading-relaxed">{review.patron}</p>
                                    </div>
                                )}

                                <ReviewList
                                    icon={Scissors}
                                    color="sky"
                                    title="Para recortar"
                                    items={review.recortar}
                                    hint="Todo lo que entra tiene que sacar algo."
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {review.foco_semana && (
                                        <div className="glass p-4 rounded-2xl border border-indigo-500/25 space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                                <Target className="w-3 h-3" /> Foco de la semana
                                            </span>
                                            <p className="text-xs text-foreground/90 leading-relaxed">{review.foco_semana}</p>
                                        </div>
                                    )}
                                    {review.un_cambio && (
                                        <div className="glass p-4 rounded-2xl border border-emerald-500/25 space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                                <Sparkles className="w-3 h-3" /> El único cambio
                                            </span>
                                            <p className="text-xs text-foreground/90 leading-relaxed">{review.un_cambio}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Card icon={Target} color="indigo" title="Metas de la semana que viene" hint="Tres como mucho.">
                        <textarea
                            rows={3}
                            value={weeklyGoals}
                            onChange={e => setWeeklyGoals(e.target.value)}
                            placeholder="1. Cerrar la propuesta del cliente nuevo…"
                            className={cn(inputCls, 'resize-y')}
                        />
                    </Card>

                    <Card icon={Brain} color="violet" title="Tu reflexión" hint="Con tus palabras, no las de la IA.">
                        <textarea
                            rows={4}
                            value={reflection}
                            onChange={e => setReflection(e.target.value)}
                            placeholder="Qué aprendiste esta semana…"
                            className={cn(inputCls, 'resize-y')}
                        />
                    </Card>

                    <button
                        onClick={handleSaveReflection}
                        disabled={savingReview}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {savingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar la revisión
                    </button>
                </div>
            )}
        </div>
    )
}

const inputCls = 'w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/40'

const COLORS: Record<string, string> = {
    indigo: 'text-indigo-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    sky: 'text-sky-400'
}

function Card({ icon: Icon, color, title, hint, children }: {
    icon: any; color: string; title: string; hint?: string; children: React.ReactNode
}) {
    return (
        <div className="glass p-4 rounded-2xl border border-border/50 space-y-2.5">
            <div>
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Icon className={cn('w-3.5 h-3.5', COLORS[color])} />
                    {title}
                </h3>
                {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {children}
        </div>
    )
}

function ReviewList({ icon: Icon, color, title, items, hint }: {
    icon: any; color: string; title: string; items?: string[]; hint?: string
}) {
    if (!items?.length) return null
    return (
        <div className="glass p-4 rounded-2xl border border-border/50 space-y-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5', COLORS[color])}>
                <Icon className="w-3 h-3" /> {title}
            </span>
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
            <ul className="space-y-1.5">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-foreground/90 leading-relaxed flex items-start gap-2">
                        <span className={cn('shrink-0', COLORS[color])}>·</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    )
}
