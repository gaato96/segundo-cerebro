'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, Trash2, Calendar as CalendarIcon, MoreVertical, GripVertical, X, Bell } from 'lucide-react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'
import { getPriorityColor, getPriorityLabel, formatDate } from '@/lib/utils'
import confetti from 'canvas-confetti'

interface TaskListProps {
    pendingTasks: any[]
    completedTasks: any[]
}

export function TaskList({ pendingTasks, completedTasks }: TaskListProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const [selectedTask, setSelectedTask] = useState<any | null>(null)

    async function handleToggleStatus(taskId: string, currentStatus: string, priority: number) {
        if (loading) return
        setLoading(taskId)

        const newStatus = currentStatus === 'Done' ? 'Todo' : 'Done'

        if (newStatus === 'Done' && priority === 1) {
            triggerConfetti()
        }

        try {
            await updateTaskStatus(taskId, newStatus)
            if (selectedTask?.id === taskId) {
                setSelectedTask((prev: any) => ({ ...prev, status: newStatus }))
            }
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
            if (selectedTask?.id === taskId) {
                setSelectedTask(null)
            }
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
            className={`group flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${isCompleted
                ? 'bg-secondary/20 border-border/30 opacity-60'
                : 'glass hover:bg-secondary/50 border-border/50 shadow-sm'
                }`}
            onClick={(e) => {
                // Prevent opening modal if clicking specific buttons inside the task row
                const target = e.target as HTMLElement
                if (!target.closest('button')) {
                    setSelectedTask(task)
                }
            }}
        >
            <div className="pt-0.5 md:pt-1 opacity-20 group-hover:opacity-100 cursor-grab hidden sm:block">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); handleToggleStatus(task.id, task.status, task.priority) }}
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

                    {task.energy_level && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground border border-border flex items-center gap-1">
                            {task.energy_level === 'Deep Work' ? '⚡' : task.energy_level === 'Low Energy' ? '🔋' : '📱'} {task.energy_level}
                        </span>
                    )}

                    {task.due_date && (
                        <span className={`text-[10px] flex items-center gap-1 ml-auto ${!isCompleted && new Date(task.due_date) < new Date() && new Date(task.due_date).toDateString() !== new Date().toDateString()
                            ? 'text-red-400 font-medium'
                            : 'text-muted-foreground'
                            }`}>
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(task.due_date)}
                        </span>
                    )}

                    {task.reminder_time && !isCompleted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {task.reminder_time.substring(0, 5)}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
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

            {/* Completed Tasks */}
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

            {/* Task Details Modal */}
            <AnimatePresence>
                {selectedTask && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTask(null)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10 overflow-hidden">
                            <div className="flex items-start justify-between p-6 border-b border-border/50 bg-secondary/10">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleToggleStatus(selectedTask.id, selectedTask.status, selectedTask.priority)}
                                        disabled={loading === selectedTask.id}
                                        className={`mt-0.5 shrink-0 transition-colors ${selectedTask.status === 'Done' ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`}
                                    >
                                        {loading === selectedTask.id ? (
                                            <div className="w-5 h-5 border-2 border-muted border-t-green-500 rounded-full animate-spin" />
                                        ) : selectedTask.status === 'Done' ? (
                                            <div className="w-5 h-5 bg-green-500 text-background rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        ) : (
                                            <Circle className="w-5 h-5" />
                                        )}
                                    </button>
                                    <div>
                                        <h2 className={`text-xl font-bold font-heading ${selectedTask.status === 'Done' ? 'line-through text-muted-foreground' : ''}`}>{selectedTask.title}</h2>
                                        <div className="flex gap-2 items-center mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(selectedTask.priority)}`}>
                                                {getPriorityLabel(selectedTask.priority)}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedTask.category === 'Work' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                                                {selectedTask.category}
                                            </span>
                                            {selectedTask.energy_level && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground border border-border flex items-center gap-1">
                                                    {selectedTask.energy_level === 'Deep Work' ? '⚡' : selectedTask.energy_level === 'Low Energy' ? '🔋' : '📱'} {selectedTask.energy_level}
                                                </span>
                                            )}
                                            {selectedTask.due_date && (
                                                <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {formatDate(selectedTask.due_date)}
                                                </span>
                                            )}
                                            {selectedTask.reminder_time && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                                                    <Bell className="w-3 h-3" />
                                                    {selectedTask.reminder_time.substring(0, 5)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                                {selectedTask.description ? selectedTask.description : <span className="text-muted-foreground italic">No hay descripción para esta tarea.</span>}
                            </div>

                            <div className="p-4 border-t border-border/50 bg-secondary/10 flex justify-end">
                                <button
                                    onClick={() => handleDelete(selectedTask.id)}
                                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Eliminar Tarea
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
