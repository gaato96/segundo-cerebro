'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ListCheck, Repeat } from 'lucide-react'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'
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
    const [editingRecurring, setEditingRecurring] = useState<any | null>(null)

    function closeRecurringForm() {
        setIsRecurringFormOpen(false)
        setEditingRecurring(null)
    }
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

    const pendingTasks = filteredTasks.filter(t => t.status === 'Todo' || t.status === 'InProgress')

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
        <PageShell wide>
            <PageHeader
                label="Planificar"
                title="Tareas"
                subtitle="El backlog por horizonte: lo vencido arriba, lo de algún día abajo."
                actions={
                    <>
                        <button onClick={() => setIsRecurringFormOpen(true)} className="btn-secondary text-sm">
                            <Repeat className="w-4 h-4" /> Recurrente
                        </button>
                        <button onClick={() => setIsFormOpen(true)} className="btn-primary text-sm">
                            <Plus className="w-4 h-4" /> Tarea
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-5 min-w-0">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-hairline w-fit">
                        {[
                            { id: 'tasks', label: 'Pendientes', icon: ListCheck, count: pendingTasks.length },
                            { id: 'recurring', label: 'Recurrentes', icon: Repeat, count: recurringTasks.length }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as 'tasks' | 'recurring')}
                                className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${activeTab === t.id ? 'bg-raised text-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <t.icon className="w-4 h-4" /> {t.label} <span className="font-mono text-[10px] text-muted-foreground">{t.count}</span>
                            </button>
                        ))}
                    </div>

                    {activeTab === 'tasks' ? (
                        <>
                            <QuickTaskInput />

                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                                    <input
                                        type="text"
                                        placeholder="Buscar"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="field !min-h-10 h-10 pl-9 text-sm"
                                    />
                                </div>
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                                    {[
                                        { v: null, l: 'Todas' }, { v: 'Work', l: 'Trabajo' }, { v: 'Personal', l: 'Personal' }
                                    ].map(o => (
                                        <button key={o.l} onClick={() => setFilterCategory(o.v)} className={`h-10 px-3 rounded-xl border text-xs shrink-0 ${filterCategory === o.v ? 'lamp text-amber-200' : 'border-hairline text-muted-foreground hover:text-foreground'}`}>
                                            {o.l}
                                        </button>
                                    ))}
                                    <select
                                        value={filterEnergy || ''}
                                        onChange={(e) => setFilterEnergy(e.target.value || null)}
                                        className="h-10 bg-card border border-hairline rounded-xl px-3 text-xs text-muted-foreground focus:outline-none shrink-0"
                                    >
                                        <option value="">Cualquier energía</option>
                                        <option value="Deep Work">Foco profundo</option>
                                        <option value="Low Energy">Liviana</option>
                                        <option value="Phone-only">Desde el celu</option>
                                    </select>
                                </div>
                            </div>

                            <TaskList pendingTasks={pendingTasks} completedTasks={completedTasks} />
                        </>
                    ) : (
                        <RecurringTaskList
                            recurringTasks={recurringTasks}
                            onEdit={(t) => { setEditingRecurring(t); setIsRecurringFormOpen(true) }}
                        />
                    )}
                </div>

                <aside className="lg:col-span-4 space-y-4 min-w-0">
                    <Panel>
                        <SectionLabel right={`${recurringTasks.length} activas`}>Recurrentes</SectionLabel>
                        {recurringTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Ninguna. Las que se repiten (pagar, planificar la semana) van acá.</p>
                        ) : (
                            <div className="-mx-2">
                                {recurringTasks.slice(0, 6).map((t: any) => (
                                    <button key={t.id} onClick={() => { setEditingRecurring(t); setIsRecurringFormOpen(true) }} className="w-full flex items-center gap-2 px-2 min-h-[40px] rounded-lg hover:bg-raised/60 text-left">
                                        <Repeat className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm truncate">{t.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Panel>
                    <Panel>
                        <SectionLabel>Escribí como pensás</SectionLabel>
                        <p className="text-sm text-muted-foreground">La entrada de arriba entiende fechas y horas:</p>
                        <ul className="mt-2 space-y-1.5 font-mono text-[12px] text-foreground/85">
                            <li>llamar al contador el jueves 10hs</li>
                            <li>pagar monotributo 25/11 urgente</li>
                            <li>turno dentista 3 de diciembre 10:30</li>
                            <li>mandar propuesta la semana que viene</li>
                        </ul>
                    </Panel>
                    <Panel>
                        <SectionLabel>Hechas hoy</SectionLabel>
                        <p className="font-mono text-3xl">{completedTasks.length}</p>
                    </Panel>
                </aside>
            </div>

            {/* Slide-over Form for Normal Task */}
            <AnimatePresence>
                {isFormOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFormOpen(false)}
                            className="fixed inset-0 bg-black/60 z-50"
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
                            onClick={closeRecurringForm}
                            className="fixed inset-0 bg-black/60 z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                        >
                            <RecurringTaskForm
                                key={editingRecurring?.id || 'new'}
                                task={editingRecurring || undefined}
                                onClose={closeRecurringForm}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </PageShell>
    )
}
