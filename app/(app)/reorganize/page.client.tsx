'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Clock, Target, MessageSquare, Wand2,
    ArrowRight, ArrowLeft, CheckCircle2, Check, Loader2,
    User, AlertCircle, RefreshCw
} from 'lucide-react'
import { generateLifePlan, applyLifeReorganization, ReorganizeInput } from '@/lib/actions/reorganize'

const slideVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -30, transition: { duration: 0.2 } }
}

const STEP_LABELS = ['Sobre vos', 'Tus metas', 'Contexto extra', 'Tu plan']

export function ReorganizeClient({ initialProfile }: { initialProfile: any }) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [successApplied, setSuccessApplied] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Free-form inputs
    const [aboutMe, setAboutMe] = useState('')
    const [problemsAndGoals, setProblemsAndGoals] = useState('')
    const [extraContext, setExtraContext] = useState('')

    // AI plan
    const [aiPlan, setAiPlan] = useState<{ routine: any[]; habits: any[]; tasks: any[] } | null>(null)

    // Selection toggles
    const [approvedRoutine, setApprovedRoutine] = useState<any[]>([])
    const [approvedHabits, setApprovedHabits] = useState<Record<string, boolean>>({})
    const [approvedTasks, setApprovedTasks] = useState<Record<string, boolean>>({})

    async function handleGenerate() {
        if (!aboutMe.trim() || !problemsAndGoals.trim()) {
            setErrorMsg('Por favor completá al menos los primeros dos pasos.')
            return
        }
        setErrorMsg(null)
        setLoading(true)
        try {
            const input: ReorganizeInput = { aboutMe, problemsAndGoals, extraContext: extraContext || undefined }
            const res = await generateLifePlan(input)
            if (res.error) { setErrorMsg(res.error); return }
            if (res.data) {
                setAiPlan(res.data)
                setApprovedRoutine(res.data.routine || [])
                const hc: Record<string, boolean> = {}
                res.data.habits?.forEach((_: any, i: number) => { hc[i] = true })
                setApprovedHabits(hc)
                const tc: Record<string, boolean> = {}
                res.data.tasks?.forEach((_: any, i: number) => { tc[i] = true })
                setApprovedTasks(tc)
                setStep(4)
            }
        } catch (e: any) {
            setErrorMsg('Error inesperado: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleApply() {
        if (!aiPlan) return
        setApplying(true)
        setErrorMsg(null)
        try {
            const habitsToApply = aiPlan.habits.filter((_: any, i: number) => approvedHabits[i])
            const tasksToApply = aiPlan.tasks.filter((_: any, i: number) => approvedTasks[i])
            const res = await applyLifeReorganization(approvedRoutine, habitsToApply, tasksToApply)
            if (res.error) { setErrorMsg(res.error); return }
            setSuccessApplied(true)
            setStep(5)
        } catch (e: any) {
            setErrorMsg('Error al aplicar: ' + e.message)
        } finally {
            setApplying(false)
        }
    }

    const canGoNext = () => {
        if (step === 1) return aboutMe.trim().length >= 30
        if (step === 2) return problemsAndGoals.trim().length >= 20
        return true
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text">Reorganizar Mi Vida</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Contame tu situación real y la IA armará tu sistema personalizado.</p>
                </div>
            </div>

            {/* Progress */}
            {step < 5 && (
                <div className="flex items-center gap-2">
                    {STEP_LABELS.map((label, i) => {
                        const s = i + 1
                        const isActive = step === s
                        const isDone = step > s
                        return (
                            <div key={s} className="flex-1 flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs transition-all ${
                                    isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' :
                                    isDone ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                    'bg-white/5 text-muted-foreground border border-white/10'
                                }`}>
                                    {isDone ? <Check className="w-4 h-4" /> : s}
                                </div>
                                <span className={`text-[10px] font-medium hidden sm:block ${isActive ? 'text-indigo-300' : 'text-muted-foreground'}`}>{label}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Error */}
            {errorMsg && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Card */}
            <div className="glass rounded-3xl border border-border/50 shadow-xl overflow-hidden min-h-[400px] flex flex-col">
                <AnimatePresence mode="wait">
                    {/* Step 1 — About Me */}
                    {step === 1 && (
                        <motion.div key="s1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-6 md:p-8 space-y-5 flex-1 flex flex-col">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <User className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-xl font-bold font-heading">Paso 1: Contame sobre vos</h2>
                                </div>
                                <p className="text-xs text-muted-foreground">Describí tu día a día: horario de trabajo, sueño, rutinas actuales. Cuanto más detallado, mejor.</p>
                            </div>

                            <div className="flex-1 space-y-3">
                                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 space-y-1">
                                    <p className="text-xs font-semibold text-indigo-300">Ejemplos de qué podés contar:</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                                        <li>Trabajo de 5am a 12pm (mediodía), de lunes a sábado</li>
                                        <li>Me despierto a las 13:00 y me duermo cerca de las 4am</li>
                                        <li>Tengo un hijo pequeño que cuido por las tardes</li>
                                        <li>Estudio desarrollo web en mi tiempo libre</li>
                                    </ul>
                                </div>

                                <textarea
                                    value={aboutMe}
                                    onChange={e => setAboutMe(e.target.value)}
                                    rows={7}
                                    placeholder="Ej: Trabajo de 5am a 12pm de lunes a sábado como repartidor. Llego a casa cansado. Me duermo a las 2am. No tengo rutina fija, a veces como cualquier cosa. Tengo 25 años y vivo solo..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-white/20"
                                />
                                <p className={`text-xs text-right ${aboutMe.length < 30 ? 'text-muted-foreground' : 'text-indigo-400'}`}>
                                    {aboutMe.length} caracteres {aboutMe.length < 30 && '(mínimo 30)'}
                                </p>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!canGoNext()}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-md"
                                >
                                    Siguiente <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2 — Problems & Goals */}
                    {step === 2 && (
                        <motion.div key="s2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-6 md:p-8 space-y-5 flex-1 flex flex-col">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Target className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-xl font-bold font-heading">Paso 2: Problemas y Objetivos</h2>
                                </div>
                                <p className="text-xs text-muted-foreground">¿Qué sentís que no está funcionando? ¿Qué querés lograr o cambiar? Sé honesto.</p>
                            </div>

                            <div className="flex-1 space-y-3">
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 space-y-1">
                                    <p className="text-xs font-semibold text-amber-300">¿De qué podés hablar?</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                                        <li>No tengo rutina, procrastino mucho</li>
                                        <li>Quiero empezar a hacer ejercicio y comer mejor</li>
                                        <li>Tengo mil tareas pero no sé por dónde empezar</li>
                                        <li>Quiero ahorrar dinero y organizar mis finanzas</li>
                                    </ul>
                                </div>

                                <textarea
                                    value={problemsAndGoals}
                                    onChange={e => setProblemsAndGoals(e.target.value)}
                                    rows={7}
                                    placeholder="Ej: Me cuesta mucho mantener hábitos. Siempre empiezo bien pero a los 3 días abandono. Quiero tener una rutina de ejercicio y leer más. También necesito organizarme mejor con el trabajo..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-white/20"
                                />
                                <p className={`text-xs text-right ${problemsAndGoals.length < 20 ? 'text-muted-foreground' : 'text-green-400'}`}>
                                    {problemsAndGoals.length} caracteres {problemsAndGoals.length < 20 && '(mínimo 20)'}
                                </p>
                            </div>

                            <div className="flex justify-between pt-2">
                                <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 flex items-center gap-2 transition-all">
                                    <ArrowLeft className="w-4 h-4" /> Atrás
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    disabled={!canGoNext()}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-md"
                                >
                                    Siguiente <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3 — Extra context (optional) */}
                    {step === 3 && (
                        <motion.div key="s3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-6 md:p-8 space-y-5 flex-1 flex flex-col">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-xl font-bold font-heading">Paso 3: Contexto Adicional <span className="text-sm font-normal text-muted-foreground">(Opcional)</span></h2>
                                </div>
                                <p className="text-xs text-muted-foreground">¿Hay algo más que quieras que la IA considere? Limitaciones, restricciones, preferencias especiales...</p>
                            </div>

                            <div className="flex-1">
                                <textarea
                                    value={extraContext}
                                    onChange={e => setExtraContext(e.target.value)}
                                    rows={6}
                                    placeholder="Ej: Tengo problemas de espalda así que no puedo hacer ejercicio de alto impacto. Prefiero actividades en casa. Tengo presupuesto limitado para comida. No me gustan las mañanas..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-white/20"
                                />
                            </div>

                            <div className="flex justify-between pt-2">
                                <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 flex items-center gap-2 transition-all">
                                    <ArrowLeft className="w-4 h-4" /> Atrás
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con IA...</>
                                    ) : (
                                        <><Wand2 className="w-4 h-4 animate-pulse" /> Generar Mi Plan</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4 — Review AI plan */}
                    {step === 4 && aiPlan && (
                        <motion.div key="s4" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-6 md:p-8 space-y-6 flex-1 flex flex-col">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-xl font-bold font-heading">Tu Plan Personalizado</h2>
                                </div>
                                <p className="text-xs text-muted-foreground">Revisá y destildá lo que no querés aplicar. Podés regenerar si algo no te convence.</p>
                            </div>

                            <div className="flex-1 space-y-6 overflow-y-auto max-h-[52vh] pr-1">
                                {/* Routine */}
                                <section className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" /> Rutina Diaria Sugerida
                                    </h3>
                                    <div className="border border-white/10 rounded-2xl bg-white/5 overflow-hidden divide-y divide-white/5">
                                        {approvedRoutine.map((item, idx) => (
                                            <div key={idx} className="p-3 flex items-center gap-3 hover:bg-white/[0.02]">
                                                <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg shrink-0 whitespace-nowrap">{item.time}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white/90 truncate">{item.activity}</p>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.category}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Habits */}
                                <section className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Hábitos a Crear</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {aiPlan.habits?.map((h: any, idx: number) => {
                                            const checked = approvedHabits[idx]
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setApprovedHabits(p => ({ ...p, [idx]: !p[idx] }))}
                                                    className={`p-3 text-left rounded-xl border text-sm font-medium transition-all flex items-center justify-between gap-3 ${
                                                        checked ? 'bg-indigo-600/10 border-indigo-500/30 text-white' : 'bg-white/5 border-transparent opacity-50 hover:opacity-80 hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: h.color_hex }} />
                                                        <div>
                                                            <p className="font-semibold text-sm leading-tight">{h.title}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{h.frequency === 'daily' ? 'Diario' : `Semanal · ${h.goal_count}x`}</p>
                                                        </div>
                                                    </div>
                                                    {checked
                                                        ? <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                                                        : <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0" />
                                                    }
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>

                                {/* Tasks */}
                                <section className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Tareas Iniciales</h3>
                                    <div className="space-y-2">
                                        {aiPlan.tasks?.map((t: any, idx: number) => {
                                            const checked = approvedTasks[idx]
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setApprovedTasks(p => ({ ...p, [idx]: !p[idx] }))}
                                                    className={`w-full p-3.5 text-left rounded-xl border text-sm font-medium transition-all flex items-start justify-between gap-4 ${
                                                        checked ? 'bg-indigo-600/10 border-indigo-500/30 text-white' : 'bg-white/5 border-transparent opacity-50 hover:opacity-80 hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${t.priority === 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                {t.priority === 1 ? 'Alta' : 'Media'}
                                                            </span>
                                                            <h4 className="font-semibold text-sm text-white/90 truncate">{t.title}</h4>
                                                        </div>
                                                        {t.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.description}</p>}
                                                    </div>
                                                    {checked
                                                        ? <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                                        : <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                                                    }
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            </div>

                            <div className="flex justify-between pt-2 border-t border-white/5 shrink-0">
                                <button
                                    onClick={() => { setAiPlan(null); setStep(3) }}
                                    className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 flex items-center gap-2 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" /> Regenerar
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={applying}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                                >
                                    {applying
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando...</>
                                        : <><Check className="w-4 h-4" /> Aplicar a Mi Cuenta</>
                                    }
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5 — Success */}
                    {step === 5 && successApplied && (
                        <motion.div key="s5" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 text-center space-y-6 flex-1 flex flex-col items-center justify-center">
                            <div className="w-24 h-24 bg-indigo-600/20 border border-indigo-500/30 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-12 h-12 text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-heading font-bold text-white">¡Tu vida está reorganizada!</h2>
                                <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                                    Tu rutina ideal fue guardada en tu perfil, se crearon tus hábitos y tus tareas iniciales están listas en tu bandeja.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => window.location.href = '/habits'}
                                    className="px-6 py-3 border border-indigo-500/30 text-indigo-300 rounded-xl font-semibold text-sm hover:bg-indigo-500/10 transition-all"
                                >
                                    Ver Hábitos
                                </button>
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                                >
                                    Ir al Dashboard <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
