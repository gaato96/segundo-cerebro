'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ListCheck, Repeat } from 'lucide-react'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskForm } from '@/components/tasks/TaskForm'
import { QuickTaskInput } from '@/components/tasks/QuickTaskInput'
import { RecurringTaskList } from '@/components/tasks/RecurringTaskList'
import { RecurringTaskForm } from '@/components/tasks/RecurringTaskForm'

interface TaskPageProps {
    initialTasks: any[]
    initialRecurringTasks: any[]
}

export function TasksClient({ initialTasks, initialRecurringTasks }: TaskPageProps) {
    const [tasks, setTasks] = useState(initialTasks)
    const [recurringTasks, setRecurringTasks] = useState(initialRecurringTasks)
    const [activeTab, setActiveTab] = useState<'tasks' | 'recurring'>('tasks')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isRecurringFormOpen, setIsRecurringFormOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState<string | null>(null)
    const [filterEnergy, setFilterEnergy] = useState<string | null>(null)

    useEffect(() => {
        setTasks(initialTasks)
    }, [initialTasks])

    useEffect(() => {
        setRecurringTasks(initialRecurringTasks)
    }, [initialRecurringTasks])

    // Filter normal tasks (not template recurring tasks)
    const activeTasks = tasks.filter(t => !t.is_recurring || t.recurring_parent_id)

    const filteredTasks = activeTasks.filter(task => {
        if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
        if (filterCategory && task.category !== filterCategory) return false
        if (filterEnergy && task.energy_level !== filterEnergy) return false
        return true
    })

    const pendingTasks = filteredTasks.filter(t => t.status !== 'Done')

    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now)
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    const argTodayStr = `${y}-${m}-${d}`

    const completedTasks = filteredTasks.filter(t => {
        if (t.status !== 'Done') return false
        if (!t.updated_at) return true

        const taskDate = new Date(t.updated_at)
        const tParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(taskDate)
        const ty = tParts.find(p => p.type === 'year')?.value
        const tm = tParts.find(p => p.type === 'month')?.value
        const td = tParts.find(p => p.type === 'day')?.value
        const taskDateStr = `${ty}-${tm}-${td}`

        return taskDateStr === argTodayStr
    })

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text">Gestión de Tareas</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Organizá tus pendientes diarios y tareas recurrentes
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === 'tasks' ? (
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Tarea
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsRecurringFormOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                        >
                            <Repeat className="w-4 h-4" />
                            Nueva Recurrente
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50 max-w-md">
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'tasks'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <ListCheck className="w-4 h-4" />
                    Tareas
                </button>
                <button
                    onClick={() => setActiveTab('recurring')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'recurring'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Repeat className="w-4 h-4" />
                    Recurrentes ({recurringTasks.length})
                </button>
            </div>

            {activeTab === 'tasks' ? (
                <>
                    {/* Quick Task Input */}
                    <QuickTaskInput />

                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar tareas..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={filterCategory || ''}
                                onChange={(e) => setFilterCategory(e.target.value || null)}
                                className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none min-w-[140px]"
                            >
                                <option value="">Todas las áreas</option>
                                <option value="Work">Trabajo</option>
                                <option value="Personal">Personal</option>
                            </select>
                            <select
                                value={filterEnergy || ''}
                                onChange={(e) => setFilterEnergy(e.target.value || null)}
                                className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none min-w-[160px]"
                            >
                                <option value="">Cualquier energía</option>
                                <option value="Deep Work">Deep Work</option>
                                <option value="Low Energy">Low Energy</option>
                                <option value="Phone-only">Phone-only</option>
                            </select>
                        </div>
                    </div>

                    {/* Task List */}
                    <TaskList
                        pendingTasks={pendingTasks}
                        completedTasks={completedTasks}
                    />
                </>
            ) : (
                /* Recurring Tasks List */
                <RecurringTaskList recurringTasks={recurringTasks} />
            )}

            {/* Slide-over Form for Normal Task */}
            <AnimatePresence>
                {isFormOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFormOpen(false)}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                        >
                            <TaskForm onClose={() => setIsFormOpen(false)} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Slide-over Form for Recurring Task */}
            <AnimatePresence>
                {isRecurringFormOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsRecurringFormOpen(false)}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                        >
                            <RecurringTaskForm onClose={() => setIsRecurringFormOpen(false)} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
