'use client'

import { useState } from 'react'
import { Clock, Sparkles, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import Link from 'next/link'

interface RoutineItem {
    time: string
    activity: string
    category: string
}

export function IdealRoutineWidget({ routine }: { routine: RoutineItem[] | null }) {
    const [isOpen, setIsOpen] = useState(false)
    const hasRoutine = routine && routine.length > 0

    return (
        <div className="glass p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden transition-all hover:bg-secondary/10">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-heading font-bold text-base text-white">Mi Rutina Ideal</h3>
                        <p className="text-xs text-muted-foreground">Estructura diaria recomendada por IA</p>
                    </div>
                </div>
                {hasRoutine ? (
                    isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : null}
            </button>

            {!hasRoutine ? (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Aún no tienes configurada una rutina diaria ideal. Usa el optimizador para estructurar tu día a día según tus necesidades.
                    </p>
                    <Link
                        href="/reorganize"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Reorganizar mi vida ahora →
                    </Link>
                </div>
            ) : (
                isOpen && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-slide-down">
                        <div className="relative border-l-2 border-indigo-500/20 ml-2.5 pl-6 space-y-4 py-1">
                            {routine.map((item, index) => (
                                <div key={index} className="relative">
                                    {/* Bullet point indicator */}
                                    <div className="absolute -left-[31px] top-1 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <div>
                                            <p className="text-xs font-mono font-bold text-indigo-300">{item.time}</p>
                                            <p className="text-sm font-semibold text-white/90 mt-0.5">{item.activity}</p>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 bg-secondary rounded self-start sm:self-center">
                                            {item.category}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 flex justify-end">
                            <Link
                                href="/reorganize"
                                className="text-xs text-muted-foreground hover:text-indigo-400 transition-colors flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" /> Ajustar rutina
                            </Link>
                        </div>
                    </div>
                )
            )}
        </div>
    )
}
