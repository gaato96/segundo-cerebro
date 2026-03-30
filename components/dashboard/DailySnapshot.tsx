'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, Flame, Calendar as CalendarIcon, MoreVertical, CheckSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'
import { getPriorityColor, getPriorityLabel } from '@/lib/utils'
import { format } from 'date-fns'

interface Task {
    id: string
    title: string
    priority: number
    category: string
    due_date: string | null
}

interface Habit {
    id: string
    title: string
    color_hex: string
}

interface DailySnapshotProps {
    tasks: Task[]
    habits: Habit[]
    completedHabitIds: Set<string>
    userId: string
}

export function DailySnapshot({ tasks: initialTasks, habits, completedHabitIds: initialCompleted, userId }: DailySnapshotProps) {
    const [tasks, setTasks] = useState(initialTasks)
    const [completedHabits, setCompletedHabits] = useState<Set<string>>(initialCompleted)
    const [loadingTask, setLoadingTask] = useState<string | null>(null)
    const [loadingHabit, setLoadingHabit] = useState<string | null>(null)

    useEffect(() => {
        setTasks(initialTasks)
    }, [initialTasks])

    useEffect(() => {
        setCompletedHabits(initialCompleted)
    }, [initialCompleted])

    const supabase = createClient()

    async function handleCompleteTask(id: string) {
        if (loadingTask) return
        setLoadingTask(id)

        const task = tasks.find(t => t.id === id)

        // Optimistic UI
        setTasks(prev => prev.filter(t => t.id !== id))

        // Trigger confetti for high priority tasks
        if (task?.priority === 1) {
            triggerConfetti()
        }

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status: 'Done', updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error completing task:', error)
            // Revert on error
            if (task) setTasks(prev => [...prev, task].sort((a, b) => a.priority - b.priority))
        } finally {
            setLoadingTask(null)
        }
    }

    async function handleToggleHabit(habitId: string) {
        if (loadingHabit) return
        setLoadingHabit(habitId)

        const isCompleted = completedHabits.has(habitId)
        const newCompleted = new Set(completedHabits)

        // Optimistic UI
        if (isCompleted) {
            newCompleted.delete(habitId)
        } else {
            newCompleted.add(habitId)
            triggerConfetti()
        }
        setCompletedHabits(newCompleted)

        try {
            if (isCompleted) {
                // Find and delete today's log
                const todayStr = format(new Date(), 'yyyy-MM-dd')
                const { error } = await supabase
                    .from('habit_logs')
                    .delete()
                    .eq('habit_id', habitId)
                    .eq('user_id', userId)
                    .gte('completed_at', `${todayStr}T00:00:00`)

                if (error) throw error
            } else {
                // Insert new log
                const { error } = await supabase
                    .from('habit_logs')
                    .insert({
                        habit_id: habitId,
                        user_id: userId,
                    })

                if (error) throw error
            }
        } catch (error) {
            console.error('Error toggling habit:', error)
            // Revert optimistic update
            setCompletedHabits(completedHabits)
        } finally {
            setLoadingHabit(null)
        }
    }

    function triggerConfetti() {
        const duration = 2000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#6366f1', '#a855f7', '#ec4899']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#6366f1', '#a855f7', '#ec4899']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks Focus List */}
            <div className="glass rounded-2xl p-6 border border-border/50 shadow-xl flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                            <CheckSquare className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-heading font-semibold">Tus Tareas Hoy</h2>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full text-muted-foreground border border-border">
                        {tasks.length} pendientes
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    <AnimatePresence mode="popLayout">
                        {tasks.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-border rounded-xl"
                            >
                                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-3">
                                    <Check className="w-6 h-6 text-green-500" />
                                </div>
                                <p className="text-sm font-medium text-foreground">¡Todo listo por hoy!</p>
                                <p className="text-xs text-muted-foreground mt-1">Disfrutá tu tiempo libre o adelantá tareas.</p>
                            </motion.div>
                        ) : (
                            tasks.map((task) => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                                    whileHover={{ scale: 1.01 }}
                                    className="group flex gap-3 p-4 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                                >
                                    <button
                                        onClick={() => handleCompleteTask(task.id)}
                                        disabled={loadingTask === task.id}
                                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-500 transition-colors"
                                    >
                                        {loadingTask === task.id ? (
                                            <div className="w-5 h-5 border-2 border-muted border-t-green-500 rounded-full animate-spin" />
                                        ) : (
                                            <Circle className="w-5 h-5 group-hover:hidden" />
                                        )}
                                        <Check className="w-5 h-5 hidden group-hover:block" />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                                                {getPriorityLabel(task.priority)}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border">
                                                {task.category}
                                            </span>
                                            {task.due_date && (
                                                <span className="text-[10px] flex items-center gap-1 text-muted-foreground ml-auto">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {format(new Date(task.due_date), 'dd/MM')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Habits Tracker */}
            <div className="glass rounded-2xl p-6 border border-border/50 shadow-xl flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg shrink-0">
                            <Flame className="w-5 h-5 text-orange-400" />
                        </div>
                        <h2 className="text-xl font-heading font-semibold">Hábitos Diarios</h2>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full text-muted-foreground border border-border">
                        {completedHabits.size}/{habits.length} listos
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {habits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-border rounded-xl">
                            <p className="text-sm text-muted-foreground">No hay hábitos configurados aún.</p>
                        </div>
                    ) : (
                        habits.map((habit) => {
                            const isDone = completedHabits.has(habit.id)
                            return (
                                <motion.div
                                    key={habit.id}
                                    whileHover={{ scale: 1.01 }}
                                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${isDone
                                        ? 'bg-secondary/20 border-border/30 opacity-60'
                                        : 'bg-secondary/50 border-border/50 border-l-4'
                                        }`}
                                    style={{ borderLeftColor: isDone ? 'transparent' : habit.color_hex }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button
                                            onClick={() => handleToggleHabit(habit.id)}
                                            disabled={loadingHabit === habit.id}
                                            className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${isDone
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'bg-background border-muted-foreground/30 text-transparent hover:border-green-500/50'
                                                }`}
                                        >
                                            {loadingHabit === habit.id ? (
                                                <div className="w-3 h-3 border-2 border-background border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                        </button>
                                        <span className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                            {habit.title}
                                        </span>
                                    </div>
                                    <button className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
