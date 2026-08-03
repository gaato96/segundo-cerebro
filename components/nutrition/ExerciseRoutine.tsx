'use client'

import { motion } from 'framer-motion'
import { Dumbbell, Clock, Flame, CheckCircle, Zap } from 'lucide-react'

interface ExerciseRoutineProps {
    exercisePlan: any
}

export function ExerciseRoutine({ exercisePlan }: ExerciseRoutineProps) {
    const routines = exercisePlan?.routines || [
        {
            day: 'Lunes',
            title: 'Rutina Full-Body en Casa (12 min)',
            exercises: [
                '12 Sentadillas peso corporal (3 series)',
                '10 Flexiones de brazos (en suelo o inclinadas) (3 series)',
                '30 seg Plancha abdominal (3 series)'
            ]
        },
        {
            day: 'Miércoles',
            title: 'Rutina Quema Grasa HIIT (15 min)',
            exercises: [
                '40 seg Jumping Jacks / Saltos de tijera (4 rondas)',
                '10 Estocadas por pierna (3 series)',
                '15 Escaladores / Mountain Climbers (3 series)'
            ]
        },
        {
            day: 'Viernes',
            title: 'Rutina Tonificación & Fuerza (14 min)',
            exercises: [
                '15 Puentes de cadera (3 series)',
                '12 Sentadillas sumo (3 series)',
                '45 seg Plancha lateral por lado (2 series)'
            ]
        }
    ]

    return (
        <div className="space-y-6">
            <div className="glass p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 to-secondary/30">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Dumbbell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-heading font-bold text-foreground">Rutinas de Ejercicio en Casa</h3>
                        <p className="text-xs text-muted-foreground">Sesiones cortas de 12 a 15 minutos diseñadas para hacer sin equipamiento</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {routines.map((item: any, idx: number) => (
                    <motion.div
                        key={idx}
                        whileHover={{ scale: 1.01 }}
                        className="glass p-5 rounded-2xl border border-border/50 space-y-4 flex flex-col justify-between"
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                    {item.day}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    12 - 15 min
                                </span>
                            </div>

                            <h4 className="text-base font-bold text-foreground pt-1">{item.title}</h4>

                            <ul className="space-y-2 pt-2">
                                {item.exercises?.map((ex: string, i: number) => (
                                    <li key={i} className="text-xs text-foreground/90 flex items-start gap-2 bg-secondary/30 p-2 rounded-lg border border-border/30">
                                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <span>{ex}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
