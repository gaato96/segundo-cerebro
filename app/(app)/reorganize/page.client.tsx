'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    Clock,
    Briefcase,
    Activity,
    AlertCircle,
    CheckSquare,
    Check,
    Plus,
    Wand2,
    Calendar,
    ChevronRight,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    RefreshCw,
    Loader2
} from 'lucide-react'
import { generateLifePlan, applyLifeReorganization, ReorganizeInput } from '@/lib/actions/reorganize'

const painPointOptions = [
    { id: 'Falta de rutina', label: 'Falta de rutina diaria estructurada' },
    { id: 'Falta de motivación', label: 'Falta de motivación o procrastinación' },
    { id: 'Exceso de tareas', label: 'Sobrecarga / Exceso de tareas desordenadas' },
    { id: 'Malos hábitos', label: 'Malos hábitos o falta de hábitos saludables' },
    { id: 'Falta de concentración', label: 'Distracción constante / Falta de foco' }
]

const focusAreaOptions = [
    { id: 'Salud', label: 'Salud y Estado Físico' },
    { id: 'Trabajo', label: 'Trabajo / Productividad Laboral' },
    { id: 'Estudio', label: 'Estudios / Desarrollo Profesional' },
    { id: 'Desarrollo Personal', label: 'Desarrollo Personal / Hobbies' },
    { id: 'Salud Mental', label: 'Salud Mental y Bienestar' }
]

export function ReorganizeClient({ initialProfile }: { initialProfile: any }) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [successApplied, setSuccessApplied] = useState(false)

    // Form states
    const [sleepWake, setSleepWake] = useState('07:00 - 23:00')
    const [occupation, setOccupation] = useState('Trabajo')
    const [energy, setEnergy] = useState('Media')
    const [selectedPainPoints, setSelectedPainPoints] = useState<string[]>([])
    const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([])
    const [customHabitGoals, setCustomHabitGoals] = useState('')

    // AI generated plan states
    const [aiPlan, setAiPlan] = useState<{
        routine: any[]
        habits: any[]
        tasks: any[]
    } | null>(null)

    // Selection states for what to apply
    const [approvedRoutine, setApprovedRoutine] = useState<any[]>([])
    const [approvedHabits, setApprovedHabits] = useState<Record<string, boolean>>({})
    const [approvedTasks, setApprovedTasks] = useState<Record<string, boolean>>({})

    const handleNext = () => setStep(prev => prev + 1)
    const handleBack = () => setStep(prev => prev - 1)

    const togglePainPoint = (id: string) => {
        setSelectedPainPoints(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleFocusArea = (id: string) => {
        setSelectedFocusAreas(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    async function handleGenerate() {
        setLoading(true)
        try {
            const input: ReorganizeInput = {
                sleepWake,
                occupation,
                energy,
                painPoints: selectedPainPoints,
                focusAreas: selectedFocusAreas,
                customHabitGoals
            }
            const res = await generateLifePlan(input)
            if (res.error) {
                alert(res.error)
                return
            }
            if (res.data) {
                setAiPlan(res.data)
                setApprovedRoutine(res.data.routine || [])
                
                // Initialize all recommended habits/tasks as approved (checked)
                const hChecked: Record<string, boolean> = {}
                res.data.habits?.forEach((h: any, idx: number) => {
                    hChecked[idx.toString()] = true
                })
                setApprovedHabits(hChecked)

                const tChecked: Record<string, boolean> = {}
                res.data.tasks?.forEach((t: any, idx: number) => {
                    tChecked[idx.toString()] = true
                })
                setApprovedTasks(tChecked)

                setStep(5) // Move to results step
            }
        } catch (e: any) {
            alert('Error generando plan: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleApply() {
        if (!aiPlan) return
        setApplying(true)
        try {
            const habitsToApply = aiPlan.habits.filter((_, idx) => approvedHabits[idx.toString()])
            const tasksToApply = aiPlan.tasks.filter((_, idx) => approvedTasks[idx.toString()])

            const res = await applyLifeReorganization(approvedRoutine, habitsToApply, tasksToApply)
            if (res.error) {
                alert(res.error)
                return
            }
            setSuccessApplied(true)
            setStep(6) // Success screen
        } catch (e: any) {
            alert('Error al aplicar cambios: ' + e.message)
        } finally {
            setApplying(false)
        }
    }

    const stepsVariants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Title */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text">Reorganizar Mi Vida</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Asistente personal para ordenar tus rutinas, hábitos y tareas.</p>
                </div>
            </div>

            {/* Stepper Progress */}
            {step <= 5 && (
                <div className="flex items-center gap-2 bg-secondary/30 p-3 rounded-2xl border border-border/50">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className="flex-1 flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs transition-all shrink-0 ${
                                step === s
                                    ? 'bg-indigo-600 text-white border border-indigo-500 shadow-md shadow-indigo-600/20'
                                    : step > s
                                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    : 'bg-white/5 text-muted-foreground border border-transparent'
                            }`}>
                                {step > s ? <Check className="w-4 h-4" /> : s}
                            </div>
                            {s < 5 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? 'bg-indigo-500/30' : 'bg-white/5'}`} />}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Form Box */}
            <div className="glass p-6 md:p-8 rounded-3xl border border-border/50 shadow-xl overflow-hidden min-h-[350px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 flex-1">
                            <div>
                                <h2 className="text-xl font-bold font-heading mb-1">Paso 1: Horarios y Ocupación</h2>
                                <p className="text-xs text-muted-foreground">Cuéntanos tus horas normales de sueño y tu ocupación principal.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-400" />
                                        ¿A qué hora sueles despertar y acostarte?
                                    </label>
                                    <input
                                        type="text"
                                        value={sleepWake}
                                        onChange={(e) => setSleepWake(e.target.value)}
                                        placeholder="Ej: 07:30 a 23:30 o 09:00 a 01:00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-indigo-400" />
                                        ¿Cuál es tu ocupación principal actual?
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Trabajo', 'Estudio', 'Mixto (Trabajo y Estudio)'].map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setOccupation(opt)}
                                                className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                                                    occupation === opt
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 flex-1">
                            <div>
                                <h2 className="text-xl font-bold font-heading mb-1">Paso 2: Energía y Puntos de Dolor</h2>
                                <p className="text-xs text-muted-foreground">Evalúa tu nivel de energía y lo que sientes que te está bloqueando.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        Nivel promedio de energía diario
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Alta', 'Media', 'Baja'].map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setEnergy(opt)}
                                                className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                                                    energy === opt
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-indigo-400" />
                                        ¿Cuáles son tus mayores problemas de organización?
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {painPointOptions.map((opt) => {
                                            const isSelected = selectedPainPoints.includes(opt.id)
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => togglePainPoint(opt.id)}
                                                    className={`p-3 text-left rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                            : 'bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                                >
                                                    {opt.label}
                                                    {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 flex-1">
                            <div>
                                <h2 className="text-xl font-bold font-heading mb-1">Paso 3: Áreas de Enfoque</h2>
                                <p className="text-xs text-muted-foreground">Selecciona las áreas de tu vida que más deseas reorganizar y potenciar.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                                    ¿En qué áreas deseas enfocarte?
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {focusAreaOptions.map((opt) => {
                                        const isSelected = selectedFocusAreas.includes(opt.id)
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => toggleFocusArea(opt.id)}
                                                className={`p-3 text-left rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                            >
                                                {opt.label}
                                                {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div key="step4" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 flex-1">
                            <div>
                                <h2 className="text-xl font-bold font-heading mb-1">Paso 4: Hábitos y Comentarios Adicionales</h2>
                                <p className="text-xs text-muted-foreground">Describe cualquier hábito que te gustaría incorporar o comentario sobre tus metas.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                        Hábitos sugeridos o comentarios adicionales (Opcional)
                                    </label>
                                    <textarea
                                        value={customHabitGoals}
                                        onChange={(e) => setCustomHabitGoals(e.target.value)}
                                        rows={4}
                                        placeholder="Ej: Quiero meditar en las mañanas, hacer ejercicio 3 veces por semana y tener tiempo de lectura antes de dormir."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 5 && aiPlan && (
                        <motion.div key="step5" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 flex-1">
                            <div>
                                <h2 className="text-xl font-bold font-heading mb-1 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    Tu Plan de Reorganización con IA
                                </h2>
                                <p className="text-xs text-muted-foreground">Hemos estructurado tu rutina y seleccionado hábitos y tareas clave. Edita la selección antes de aplicar.</p>
                            </div>

                            <div className="space-y-6 overflow-y-auto max-h-[50vh] pr-1">
                                {/* Routine preview */}
                                <div className="space-y-3">
                                    <h3 className="font-heading font-bold text-sm text-indigo-400 uppercase tracking-wider">1. Rutina Diaria Sugerida</h3>
                                    <div className="border border-white/10 rounded-2xl bg-white/5 overflow-hidden divide-y divide-white/5">
                                        {approvedRoutine.map((item, idx) => (
                                            <div key={idx} className="p-3 flex items-start gap-4 hover:bg-white/[0.02]">
                                                <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md mt-0.5">
                                                    {item.time}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white/90">{item.activity}</p>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{item.category}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Habits check preview */}
                                <div className="space-y-3">
                                    <h3 className="font-heading font-bold text-sm text-indigo-400 uppercase tracking-wider">2. Hábitos Recomendados (Selecciona los que desees crear)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {aiPlan.habits?.map((h: any, idx: number) => {
                                            const isChecked = approvedHabits[idx.toString()]
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setApprovedHabits(prev => ({ ...prev, [idx.toString()]: !prev[idx.toString()] }))}
                                                    className={`p-3 text-left rounded-xl border text-sm font-medium transition-all flex items-center justify-between gap-3 ${
                                                        isChecked
                                                            ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                                                            : 'bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color_hex }} />
                                                        <div>
                                                            <p className="font-semibold text-sm leading-tight">{h.title}</p>
                                                            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{h.frequency === 'daily' ? 'Diario' : `Semanal (${h.goal_count} veces)`}</p>
                                                        </div>
                                                    </div>
                                                    {isChecked ? (
                                                        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Tasks check preview */}
                                <div className="space-y-3">
                                    <h3 className="font-heading font-bold text-sm text-indigo-400 uppercase tracking-wider">3. Tareas Iniciales de Enfoque</h3>
                                    <div className="space-y-2">
                                        {aiPlan.tasks?.map((t: any, idx: number) => {
                                            const isChecked = approvedTasks[idx.toString()]
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setApprovedTasks(prev => ({ ...prev, [idx.toString()]: !prev[idx.toString()] }))}
                                                    className={`p-3.5 text-left rounded-xl border text-sm font-medium transition-all flex items-start justify-between gap-4 ${
                                                        isChecked
                                                            ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                                                            : 'bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:bg-white/10 text-muted-foreground'
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                                                t.priority === 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                                            }`}>
                                                                Prio {t.priority}
                                                            </span>
                                                            <h4 className="font-semibold text-sm text-white/90 truncate">{t.title}</h4>
                                                        </div>
                                                        {t.description && <p className="text-xs text-muted-foreground mt-1 font-normal leading-relaxed">{t.description}</p>}
                                                    </div>
                                                    {isChecked ? (
                                                        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0 mt-0.5" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 6 && successApplied && (
                        <motion.div key="step6" variants={stepsVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 text-center py-8">
                            <div className="w-20 h-20 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-heading font-bold text-white">¡Vida Reorganizada!</h2>
                                <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                                    Hemos guardado tu rutina ideal en tu perfil, configurado tus nuevos hábitos y creado tus tareas iniciales. 
                                    ¡Es hora de empezar a tomar el control!
                                </p>
                            </div>
                            <div className="pt-4">
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 mx-auto"
                                >
                                    Ir al Dashboard
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                {step <= 5 && (
                    <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-6 shrink-0">
                        {step > 1 && step < 5 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" /> Atrás
                            </button>
                        ) : step === 5 ? (
                            <button
                                type="button"
                                onClick={() => setStep(4)} // go back to questionnaire comments
                                className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" /> Rehacer Quiz
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : step === 4 ? (
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={loading}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Analizando con IA...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4 animate-pulse" />
                                        Generar Plan de Vida
                                    </>
                                )}
                            </button>
                        ) : step === 5 ? (
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={applying}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {applying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Configurando Sistema...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Aplicar Cambios a Mi Cuenta
                                    </>
                                )}
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    )
}
