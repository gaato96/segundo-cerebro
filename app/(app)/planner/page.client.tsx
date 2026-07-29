'use client'

import { useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, Save, Loader2, Target, BookOpen } from 'lucide-react'
import { assignTaskToDay, unassignTaskFromDay, saveWeeklyPlan, WeeklyPlanItem } from '@/lib/actions/weekly_plans'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { WeekColumn } from '@/components/planner/WeekColumn'
import { UnplannedSidebar } from '@/components/planner/UnplannedSidebar'
import { EventItem } from '@/lib/actions/events'
import { TaskForm } from '@/components/tasks/TaskForm'

interface PlannerClientProps {
    initialTasks: any[]
    initialUnplanned: any[]
    initialEvents: EventItem[]
    initialPlan: WeeklyPlanItem | null
    mondayStr: string
}

export function PlannerClient({
    initialTasks,
    initialUnplanned,
    initialEvents,
    initialPlan,
    mondayStr
}: PlannerClientProps) {
    const [tasks, setTasks] = useState<any[]>(initialTasks)
    const [unplanned, setUnplanned] = useState<any[]>(initialUnplanned)
    const [weeklyGoals, setWeeklyGoals] = useState(initialPlan?.weekly_goals || '')
    const [reflection, setReflection] = useState(initialPlan?.reflection || '')
    const [saving, setSaving] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [taskDefaultDate, setTaskDefaultDate] = useState<string | undefined>()

    // Generate week days (Mon-Sun)
    const monDate = new Date(mondayStr + 'T00:00:00')
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((name, i) => {
        const d = new Date(monDate)
        d.setDate(monDate.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        return { name, dateStr }
    })

    const todayStr = new Date().toISOString().split('T')[0]

    async function handleAssignToDay(taskId: string, dayDate: string) {
        setUnplanned(prev => prev.filter(t => t.id !== taskId))
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, planned_date: dayDate } : t))
        await assignTaskToDay(taskId, dayDate)
    }

    async function handleUnassign(taskId: string) {
        const task = tasks.find(t => t.id === taskId)
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, planned_date: null } : t))
        if (task) setUnplanned(prev => [...prev, { ...task, planned_date: null }])
        await unassignTaskFromDay(taskId)
    }

    async function handleCompleteTask(taskId: string) {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setUnplanned(prev => prev.filter(t => t.id !== taskId))
        await updateTaskStatus(taskId, 'Done')
    }

    async function handleSaveNotes() {
        setSaving(true)
        await saveWeeklyPlan(mondayStr, {}, weeklyGoals, reflection)
        setSaving(false)
    }

    const openAddTaskModal = (dateStr?: string) => {
        setTaskDefaultDate(dateStr)
        setIsTaskModalOpen(true)
    }

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Planificador Semanal
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Organizá tus tareas por día y alinealas con tus reuniones del calendario.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveNotes}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Plan
                    </button>
                </div>
            </div>

            {/* Goals & Reflection Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass p-4 rounded-2xl border border-border/50 flex items-start gap-3">
                    <Target className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                    <div className="flex-1">
                        <label className="text-xs font-bold text-white uppercase tracking-wider block mb-1">
                            Objetivos de esta Semana
                        </label>
                        <input
                            type="text"
                            value={weeklyGoals}
                            onChange={(e) => setWeeklyGoals(e.target.value)}
                            placeholder="Ej: Completar propuesta de proyecto X, Entrenar 4 días..."
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="glass p-4 rounded-2xl border border-border/50 flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-purple-400 shrink-0 mt-1" />
                    <div className="flex-1">
                        <label className="text-xs font-bold text-white uppercase tracking-wider block mb-1">
                            Reflexión / Balance Dominical
                        </label>
                        <input
                            type="text"
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            placeholder="¿Qué funcionó bien esta semana? ¿Qué ajustar para la próxima?"
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                    </div>
                </div>
            </div>

            {/* Main Planner Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 7 Columns for Days */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
                    {weekDays.map((day) => {
                        const dayTasks = tasks.filter(t => t.planned_date === day.dateStr && t.status !== 'Done')
                        const dayEvents = initialEvents.filter(ev => ev.event_date === day.dateStr)

                        return (
                            <WeekColumn
                                key={day.dateStr}
                                dayName={day.name}
                                dateStr={day.dateStr}
                                isToday={day.dateStr === todayStr}
                                tasks={dayTasks}
                                events={dayEvents}
                                onCompleteTask={handleCompleteTask}
                                onAddTaskToDay={openAddTaskModal}
                                onUnassignTask={handleUnassign}
                            />
                        )
                    })}
                </div>

                {/* Backlog Sidebar */}
                <div className="lg:col-span-1">
                    <UnplannedSidebar
                        tasks={unplanned}
                        weekDays={weekDays}
                        onAssignToDay={handleAssignToDay}
                        onCompleteTask={handleCompleteTask}
                        onAddNewTask={() => openAddTaskModal()}
                    />
                </div>
            </div>

            {isTaskModalOpen && (
                <TaskForm
                    onClose={() => setIsTaskModalOpen(false)}
                    initialDate={taskDefaultDate}
                />
            )}
        </div>
    )
}
