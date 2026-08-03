'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Repeat, Trash2, Calendar, Zap, Flag, Tag, Clock } from 'lucide-react'
import { deleteRecurringTask } from '@/lib/actions/tasks'
import { getPriorityColor, getPriorityLabel, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface RecurringTaskListProps {
    recurringTasks: any[]
}

const RECURRENCE_LABELS: Record<string, string> = {
    daily: 'Todos los días',
    weekly: 'Semanalmente',
    biweekly: 'Cada 2 semanas',
    monthly: 'Mensualmente',
    quarterly: 'Cada 3 meses',
    custom: 'Personalizado'
}

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function RecurringTaskList({ recurringTasks }: RecurringTaskListProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const router = useRouter()

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta plantilla recurrente y sus instancias futuras?')) return
        setLoadingId(id)
        try {
            await deleteRecurringTask(id)
            router.refresh()
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingId(null)
        }
    }

    if (!recurringTasks || recurringTasks.length === 0) {
        return (
            <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                    <Repeat className="w-7 h-7 text-indigo-400" />
                </div>
                <h3 className="text-lg font-heading font-medium text-foreground">No tenés tareas recurrentes</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Creá tareas que se repiten automáticamente (ej. todos los lunes, mensual, trimestral).
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <AnimatePresence mode="popLayout">
                {recurringTasks.map((task) => {
                    const daysStr = task.recurrence_days && task.recurrence_days.length > 0
                        ? task.recurrence_days.map((d: number) => DAY_NAMES[d]).join(', ')
                        : null

                    return (
                        <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass p-4 rounded-xl border border-border/50 shadow-sm flex items-start justify-between gap-4 group"
                        >
                            <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <Repeat className="w-4 h-4" />
                                    </span>
                                    <h4 className="text-base font-semibold text-foreground truncate">{task.title}</h4>
                                </div>

                                {task.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {RECURRENCE_LABELS[task.recurrence_type] || task.recurrence_type}
                                        {daysStr && ` (${daysStr})`}
                                    </span>

                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                                        {getPriorityLabel(task.priority)}
                                    </span>

                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border">
                                        {task.category}
                                    </span>

                                    {task.next_occurrence_date && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                                            <Calendar className="w-3 h-3 text-indigo-400" />
                                            Próxima: {formatDate(task.next_occurrence_date)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDelete(task.id)}
                                disabled={loadingId === task.id}
                                className="p-2 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
