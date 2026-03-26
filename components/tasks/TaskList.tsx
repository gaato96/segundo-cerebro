'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, Trash2, Calendar as CalendarIcon, MoreVertical, GripVertical } from 'lucide-react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'
import { getPriorityColor, getPriorityLabel, formatDate } from '@/lib/utils'
import confetti from 'canvas-confetti'

interface TaskListProps {
    pendingTasks: any[]
    completedTasks: any[]
}

export function TaskList({ pendingTasks, completedTasks }: TaskListProps) {
    const [loading, setLoading] = useState<string | null>(null)

    async function handleToggleStatus(taskId: string, currentStatus: string, priority: number) {
        if (loading) return
        setLoading(taskId)

        const newStatus = currentStatus === 'Done' ? 'Todo' : 'Done'

        if (newStatus === 'Done' && priority === 1) {
            triggerConfetti()
        }

        try {
            await updateTaskStatus(taskId, newStatus)
        } catch (error) {
            console.error('Failed to update status', error)
        } finally {
            setLoading(null)
        }
    }

    async function handleDelete(taskId: string) {
        if (!confirm('¿Seguro que querés eliminar esta tarea?')) return
        setLoading(taskId)
        try {
            await deleteTask(taskId)
        } catch (error) {
            console.error('Failed to delete task', error)
        } finally {
            setLoading(null)
        }
    }

    function triggerConfetti() {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ef4444', '#f59e0b', '#3b82f6']
        })
    }

    const renderTask = (task: any, isCompleted: boolean = false) => (
        <motion.div
            layout
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.005 }}
            className={`group flex items-start gap-3 p-4 rounded-xl border transition-all ${isCompleted
                    ? 'bg-secondary/20 border-border/30 opacity-60'
                    : 'glass hover:bg-secondary/50 border-border/50 shadow-sm'
                }`}
        >
            <div className="pt-0.5 md:pt-1 opacity-20 group-hover:opacity-100 cursor-grab hidden sm:block">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <button
                onClick={() => handleToggleStatus(task.id, task.status, task.priority)}
                disabled={loading === task.id}
                className={`mt-1 shrink-0 transition-colors ${isCompleted ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'
                    }`}
            >
                {loading === task.id ? (
                    <div className="w-5 h-5 border-2 border-muted border-t-green-500 rounded-full animate-spin" />
                ) : isCompleted ? (
                    <div className="w-5 h-5 bg-green-500 text-background rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3" />
                    </div>
                ) : (
                    <div className="relative">
                        <Circle className="w-5 h-5 group-hover:hidden" />
                        <Check className="w-5 h-5 hidden group-hover:block" />
                    </div>
                )}
            </button>

            <div className="flex-1 min-w-0">
                <p className={`text-base font-medium transition-colors ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                </p>

                {task.description && !isCompleted && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                    {!isCompleted && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                        </span>
                    )}

                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${task.category === 'Work' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                        {task.category}
                    </span>

                    {task.due_date && (
                        <span className={`text-[10px] flex items-center gap-1 ml-auto ${!isCompleted && new Date(task.due_date) < new Date() && new Date(task.due_date).toDateString() !== new Date().toDateString()
                                ? 'text-red-400 font-medium'
                                : 'text-muted-foreground'
                            }`}>
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(task.due_date)}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
                    <MoreVertical className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    )

    return (
        <div className="space-y-8">
            {/* Pending Tasks */}
            <div className="space-y-3">
                {pendingTasks.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium text-foreground">¡Bandeja en cero!</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            No tenés tareas pendientes. Es un buen momento para vaciar tu cabeza (Brain Dump) o descansar.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {pendingTasks.map((task) => renderTask(task, false))}
                    </AnimatePresence>
                )}
            </div>

            {/* Completed Tasks (Collapsible or just separated) */}
            {completedTasks.length > 0 && (
                <div className="pt-6 border-t border-border/50">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4 px-1">Completadas hoy</h3>
                    <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                            {completedTasks.map((task) => renderTask(task, true))}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    )
}
