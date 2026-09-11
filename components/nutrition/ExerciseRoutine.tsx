'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Dumbbell, ArrowRight, Repeat, CalendarRange, Wrench, History } from 'lucide-react'
import { useState } from 'react'

interface ExerciseRoutineProps {
    /** Rutina vieja guardada dentro del plan de nutrición (queda solo como archivo). */
    exercisePlan: any
}

const FEATURES = [
    {
        icon: CalendarRange,
        title: '12 semanas completas',
        text: '3 bloques de progresión (adaptación, hipertrofia, fuerza) con semanas de descarga en la 4, 8 y 12.'
    },
    {
        icon: Repeat,
        title: 'Ejercicios distintos cada semana',
        text: 'La rotación es automática dentro de cada patrón de movimiento. Nunca dos semanas iguales.'
    },
    {
        icon: Wrench,
        title: 'Tu equipamiento real',
        text: 'Mancuernas, barra, kettlebell, bandas, barra de dominadas, máquinas o solo peso corporal.'
    },
    {
        icon: Dumbbell,
        title: 'Soga incluida y progresiva',
        text: 'Entrada en calor con soga e intervalos que van de 6×30" a 10×60" a lo largo del trimestre.'
    }
]

export function ExerciseRoutine({ exercisePlan }: ExerciseRoutineProps) {
    const [showLegacy, setShowLegacy] = useState(false)
    const legacyRoutines = exercisePlan?.routines || []

    return (
        <div className="space-y-5">
            <div className="glass p-6 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/20 to-secondary/20 space-y-5">
                <div className="flex items-start gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                        <Dumbbell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-heading font-bold text-foreground leading-tight">
                            El entrenamiento ahora tiene módulo propio
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Ya no son tres rutinas fijas sin equipamiento. Ahora se genera un plan trimestral entero,
                            adaptado a lo que tenés en casa o en el gimnasio.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon
                        return (
                            <motion.div
                                key={i}
                                whileHover={{ scale: 1.01 }}
                                className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 space-y-1.5"
                            >
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.text}</p>
                            </motion.div>
                        )
                    })}
                </div>

                <Link
                    href="/entrenamiento"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                    Ir a mi plan de entrenamiento
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {legacyRoutines.length > 0 && (
                <div className="space-y-2">
                    <button
                        onClick={() => setShowLegacy(v => !v)}
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                    >
                        <History className="w-3.5 h-3.5" />
                        {showLegacy ? 'Ocultar' : 'Ver'} la rutina vieja guardada en este plan de comidas
                    </button>

                    {showLegacy && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 opacity-70">
                            {legacyRoutines.map((item: any, idx: number) => (
                                <div key={idx} className="glass p-4 rounded-xl border border-border/50 space-y-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {item.day}
                                    </span>
                                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                                    <ul className="space-y-1">
                                        {item.exercises?.map((ex: string, i: number) => (
                                            <li key={i} className="text-[11px] text-muted-foreground">• {ex}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
