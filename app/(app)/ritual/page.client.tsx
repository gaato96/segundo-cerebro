'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, CheckCircle2, ArrowRight, ArrowLeft, Flame, Inbox, Sparkles, Loader2, Settings, Target } from 'lucide-react'
import { saveRitualLog, MorningRitualLog } from '@/lib/actions/morning_ritual'
import { RitualStepper } from '@/components/ritual/RitualStepper'
import { MITSelector } from '@/components/ritual/MITSelector'
import { DayTimeline } from '@/components/ritual/DayTimeline'
import Link from 'next/link'
import confetti from 'canvas-confetti'

interface RitualClientProps {
    config: any
    existingLog: MorningRitualLog | null
    morningData: any
    todayStr: string
}

export function RitualClient({ config, existingLog, morningData, todayStr }: RitualClientProps) {
    const [stepIndex, setStepIndex] = useState(0)
    const [dailyObjective, setDailyObjective] = useState(existingLog?.daily_objective || '')
    const [selectedMitIds, setSelectedMitIds] = useState<string[]>([])
    const [completedHabits, setCompletedHabits] = useState<Set<string>>(new Set())
    const [affirmation, setAffirmation] = useState(existingLog?.affirmation || 'Hoy voy a estar enfocado, presente y dar lo mejor de mí.')
    const [loading, setLoading] = useState(false)
    const [isCompleted, setIsCompleted] = useState(!!existingLog)

    const steps = [
        { id: 'objective', label: '1. Objetivo #1' },
        { id: 'tasks', label: '2. Tareas Focus' },
        { id: 'habits', label: '3. Hábitos' },
        { id: 'inbox', label: '4. Inbox & Eventos' },
        { id: 'affirmation', label: '5. Intención' },
        { id: 'summary', label: '6. Listo' }
    ]

    function toggleMit(id: string) {
        if (selectedMitIds.includes(id)) {
            setSelectedMitIds(prev => prev.filter(i => i !== id))
        } else {
            if (selectedMitIds.length >= 3) return
            setSelectedMitIds(prev => [...prev, id])
        }
    }

    async function handleCompleteRitual() {
        setLoading(true)
        const res = await saveRitualLog(todayStr, dailyObjective, affirmation)
        setLoading(false)

        if (res.error) {
            alert(res.error)
        } else {
            setIsCompleted(true)
            triggerConfetti()
        }
    }

    function triggerConfetti() {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Sun className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                            Ritual Matutino
                        </h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Diseñá tu día antes de que el día te controle a vos.
                        </p>
                    </div>
                </div>

                {isCompleted && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Ritual Completado
                    </span>
                )}
            </div>

            {/* Stepper Header */}
            <RitualStepper
                steps={steps}
                currentStepIndex={stepIndex}
                onStepClick={(idx) => setStepIndex(idx)}
            />

            {/* Step Card Content */}
            <div className="glass rounded-3xl p-6 md:p-8 border border-border/50 shadow-xl min-h-[400px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                    {stepIndex === 0 && (
                        <motion.div
                            key="step0"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4 flex-1"
                        >
                            <div className="flex items-center gap-2 text-amber-400 font-heading font-bold text-lg">
                                <Target className="w-5 h-5" />
                                {config?.daily_objective_prompt || '¿Cuál es tu objetivo #1 de hoy?'}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Si solo pudieras lograr UNA sola cosa hoy para considerar el día un éxito, ¿cuál sería?
                            </p>
                            <textarea
                                rows={4}
                                value={dailyObjective}
                                onChange={(e) => setDailyObjective(e.target.value)}
                                placeholder="Ej: Lanzar la propuesta del cliente X / Terminar informe..."
                                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-medium"
                            />
                        </motion.div>
                    )}

                    {stepIndex === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4 flex-1"
                        >
                            <h3 className="font-heading font-bold text-lg text-white">
                                Seleccioná tus 3 Tareas Focus (MITs)
                            </h3>
                            <MITSelector
                                tasks={morningData?.tasks || []}
                                selectedMitIds={selectedMitIds}
                                onToggleMit={toggleMit}
                            />
                        </motion.div>
                    )}

                    {stepIndex === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4 flex-1"
                        >
                            <div className="flex items-center gap-2 text-orange-400 font-heading font-bold text-lg">
                                <Flame className="w-5 h-5" />
                                Hábitos Programados para Hoy
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Repasá tus hábitos diarios. ¡Mentalizate para cumplirlos!
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                {(morningData?.habits || []).map((h: any) => (
                                    <div
                                        key={h.id}
                                        className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between"
                                        style={{ borderLeftWidth: 4, borderLeftColor: h.color_hex }}
                                    >
                                        <span className="text-sm font-semibold text-white">{h.title}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">{h.estimated_minutes || 15} min</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {stepIndex === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-6 flex-1"
                        >
                            {/* Inbox Notice */}
                            <div className="glass p-4 rounded-2xl border border-indigo-500/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                                        <Inbox className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Bandeja de Entrada</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Tenés {morningData?.inboxUnreadCount || 0} capturas rápidas sin procesar.
                                        </p>
                                    </div>
                                </div>
                                {morningData?.inboxUnreadCount > 0 && (
                                    <Link
                                        href="/inbox"
                                        className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        Procesar Ahora →
                                    </Link>
                                )}
                            </div>

                            {/* Today's Meetings */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-white font-heading">
                                    Eventos & Reuniones de Hoy
                                </h4>
                                <DayTimeline events={morningData?.events || []} />
                            </div>
                        </motion.div>
                    )}

                    {stepIndex === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4 flex-1"
                        >
                            <div className="flex items-center gap-2 text-purple-400 font-heading font-bold text-lg">
                                <Sparkles className="w-5 h-5" />
                                Intención del Día
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Escribí una frase de intención o afirmación para encarar el día con la mejor actitud.
                            </p>
                            <textarea
                                rows={3}
                                value={affirmation}
                                onChange={(e) => setAffirmation(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-medium"
                            />
                        </motion.div>
                    )}

                    {stepIndex === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-6 flex-1 text-center py-4"
                        >
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-xl text-white">
                                    ¡Tu día está totalmente planificado!
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    Objetivo #1: "{dailyObjective || 'Sin definir'}"
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Navigation Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <button
                        onClick={() => setStepIndex(prev => Math.max(0, prev - 1))}
                        disabled={stepIndex === 0}
                        className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-4 h-4" /> Anterior
                    </button>

                    {stepIndex < steps.length - 1 ? (
                        <button
                            onClick={() => setStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                        >
                            Siguiente <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCompleteRitual}
                            disabled={loading}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Completar Ritual Matutino
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
