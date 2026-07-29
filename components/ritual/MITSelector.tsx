'use client'

import { motion } from 'framer-motion'
import { Star, Circle, Check } from 'lucide-react'
import { getPriorityColor, getPriorityLabel } from '@/lib/utils'

interface MITSelectorProps {
    tasks: any[]
    selectedMitIds: string[]
    onToggleMit: (id: string) => void
}

export function MITSelector({ tasks, selectedMitIds, onToggleMit }: MITSelectorProps) {
    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                Elegí hasta 3 tareas como tus **MITs (Most Important Tasks)** del día. Estas serán tu foco absoluto.
            </p>

            {tasks.length === 0 ? (
                <div className="glass p-6 text-center rounded-2xl border border-border/50 text-xs text-muted-foreground italic">
                    No tenés tareas pendientes para hoy.
                </div>
            ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {tasks.map((task) => {
                        const isSelected = selectedMitIds.includes(task.id)
                        return (
                            <motion.div
                                key={task.id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() => onToggleMit(task.id)}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md'
                                        : 'bg-secondary/40 border-border/50 hover:bg-secondary/60'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                        isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-muted-foreground/30'
                                    }`}>
                                        {isSelected && <Star className="w-3.5 h-3.5 fill-current" />}
                                    </div>
                                    <span className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-200' : 'text-white'}`}>
                                        {task.title}
                                    </span>
                                </div>

                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                                    {getPriorityLabel(task.priority)}
                                </span>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
