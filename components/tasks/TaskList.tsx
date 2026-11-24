'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, Trash2, Calendar as CalendarIcon, GripVertical, Bell, Repeat, AlertCircle } from 'lucide-react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'
import { getPriorityColor, getPriorityLabel, formatDate, isTaskOverdue } from '@/lib/utils'
import confetti from 'canvas-confetti'
import { TaskEditModal } from './TaskEditModal'

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
            colors: ['#E0A54B', '#6FAE8C', '#EDEDEF']
        })
    }

    const renderTask = (task: any, isCompleted: boolean = false) => {
        const overdue = !isCompleted && isTaskOverdue(task.due_date, task.status)
        return (
        <motion.div
            layout
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group relative flex items-start gap-3 px-4 py-3 min-h-[56px] transition-colors cursor-pointer border-b border-hairline last:border-0 ${isCompleted
                ? 'opacity-55'
                : 'hover:bg-raised/50'
                }`}
            onClick={(e) => {
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
                        <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                ) : (
                    <div className="relative">
                        <Circle className="w-5 h-5 group-hover:hidden" />
                        <Check className="w-5 h-5 hidden group-hover:block" />
                    </div>
                )}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {task.recurring_parent_id && (
                        <span className="p-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="Tarea recurrente">
                            <Repeat className="w-3 h-3" />
                        </span>
                    )}
                    <p className={`text-base font-medium transition-colors ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                    </p>
                </div>

                {task.description && !isCompleted && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                    {!isCompleted && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                        </span>
                    )}

                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${task.category === 'Work' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                        {task.category}
                    </span>

                    {task.energy_level && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground border border-border flex items-center gap-1">
                            {task.energy_level === 'Deep Work' ? 'Foco profundo' : task.energy_level === 'Low Energy' ? 'Liviana' : 'Desde el celu'}
                        </span>
                    )}

                    {overdue && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1 ml-auto">
                            <AlertCircle className="w-3 h-3" />
                            Vencida
                        </span>
                    )}

                    {task.due_date && (
                        <span className={`text-[11px] flex items-center gap-1 ${overdue ? 'text-red-400 font-medium' : 'text-muted-foreground ml-auto'}`}>
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(task.due_date)}
                        </span>
                    )}

                    {task.reminder_time && !isCompleted && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
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
    }

    // Horizontes: lo vencido primero, después hoy, mañana, la semana y lo que no tiene fecha.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
    const plus = (n: number) => {
        const [y, m, d] = today.split('-').map(Number)
        const dt = new Date(y, m - 1, d + n)
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    }
    const tomorrow = plus(1)
    const weekEnd = plus(6)
    const dayOf = (t: any) => (t.planned_date ? String(t.planned_date).slice(0, 10) : null) || (t.due_date ? String(t.due_date).slice(0, 10) : null)
    const groups: { id: string; label: string; tasks: any[]; tone?: string }[] = [
        { id: 'overdue', label: 'Vencidas', tone: 'text-red-300', tasks: pendingTasks.filter(t => t.due_date && String(t.due_date).slice(0, 10) < today) },
        { id: 'today', label: 'Hoy', tasks: [] },
        { id: 'tomorrow', label: 'Mañana', tasks: [] },
        { id: 'week', label: 'Esta semana', tasks: [] },
        { id: 'later', label: 'Más adelante', tasks: [] },
        { id: 'someday', label: 'Algún día', tasks: [] }
    ]
    const overdueIds = new Set(groups[0].tasks.map(t => t.id))
    for (const t of pendingTasks) {
        if (overdueIds.has(t.id)) continue
        const d = dayOf(t)
        if (!d) groups[5].tasks.push(t)
        else if (d <= today) groups[1].tasks.push(t)
        else if (d === tomorrow) groups[2].tasks.push(t)
        else if (d <= weekEnd) groups[3].tasks.push(t)
        else groups[4].tasks.push(t)
    }

    return (
        <div className="space-y-8">
            {pendingTasks.length === 0 ? (
                <div className="rounded-2xl p-12 text-center border border-dashed border-hairline flex flex-col items-center">
                    <Check className="w-7 h-7 text-emerald-400 mb-3" />
                    <h3 className="text-base font-medium">Nada pendiente</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Lo que se te cruce, anotalo con la tecla C y vaciá el Inbox a la mañana.
                    </p>
                </div>
            ) : groups.filter(g => g.tasks.length).map(g => (
                <section key={g.id}>
                    <h3 className={`label-caps mb-2 flex items-center gap-2 ${g.tone || ''}`}>
                        {g.id === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                        {g.label} <span className="font-mono text-ink-faint normal-case tracking-normal">{g.tasks.length}</span>
                    </h3>
                    <div className="rounded-2xl bg-card border border-hairline overflow-hidden">
                        <AnimatePresence mode="popLayout">
                            {g.tasks.map((task) => renderTask(task, false))}
                        </AnimatePresence>
                    </div>
                </section>
            ))}

            {completedTasks.length > 0 && (
                <section>
                    <h3 className="label-caps mb-2">Hechas hoy <span className="font-mono text-ink-faint normal-case tracking-normal">{completedTasks.length}</span></h3>
                    <div className="rounded-2xl bg-card border border-hairline overflow-hidden">
                        <AnimatePresence mode="popLayout">
                            {completedTasks.map((task) => renderTask(task, true))}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* Task Edit Modal */}
            <TaskEditModal
                task={selectedTask}
                isOpen={!!selectedTask}
                onClose={() => setSelectedTask(null)}
            />
        </div>
    )
}
