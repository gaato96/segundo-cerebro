'use client'

import { useState, useCallback } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    UniqueIdentifier
} from '@dnd-kit/core'
import { CalendarRange, ChevronLeft, ChevronRight, Save, Loader2, Target, BookOpen } from 'lucide-react'
import { assignTaskToDay, unassignTaskFromDay, saveWeeklyPlan, WeeklyPlanItem, getUnplannedTasks } from '@/lib/actions/weekly_plans'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { WeekColumn } from '@/components/planner/WeekColumn'
import { UnplannedSidebar } from '@/components/planner/UnplannedSidebar'
import { TaskDragCard } from '@/components/planner/TaskDragCard'
import { EventItem } from '@/lib/actions/events'
import { TaskForm } from '@/components/tasks/TaskForm'
import { getEventsByDateRange } from '@/lib/actions/events'

const BACKLOG_DROP_ID = 'backlog'
const DAY_PREFIX = 'day:'

interface PlannerClientProps {
    initialTasks: any[]
    initialUnplanned: any[]
    initialEvents: EventItem[]
    initialPlan: WeeklyPlanItem | null
    initialMondayStr: string
}

function getMondayStr(offsetWeeks: number): string {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7)
    return monday.toISOString().split('T')[0]
}

function getWeekDays(mondayStr: string) {
    const monDate = new Date(mondayStr + 'T00:00:00')
    return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((name, i) => {
        const d = new Date(monDate)
        d.setDate(monDate.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        return { name, dateStr }
    })
}

export function PlannerClient({
    initialTasks,
    initialUnplanned,
    initialEvents,
    initialPlan,
    initialMondayStr
}: PlannerClientProps) {
    // Week navigation state (0 = current week)
    const [weekOffset, setWeekOffset] = useState(0)
    const [mondayStr, setMondayStr] = useState(initialMondayStr)
    const [events, setEvents] = useState<EventItem[]>(initialEvents)
    const [tasks, setTasks] = useState<any[]>(initialTasks)
    const [unplanned, setUnplanned] = useState<any[]>(initialUnplanned)
    const [weeklyGoals, setWeeklyGoals] = useState(initialPlan?.weekly_goals || '')
    const [reflection, setReflection] = useState(initialPlan?.reflection || '')
    const [saving, setSaving] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [taskDefaultDate, setTaskDefaultDate] = useState<string | undefined>()

    // DnD state
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
    const [overId, setOverId] = useState<UniqueIdentifier | null>(null)

    const weekDays = getWeekDays(mondayStr)
    const todayStr = new Date().toISOString().split('T')[0]

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    // ─── Week Navigation ──────────────────────────────────────────────
    async function handleChangeWeek(delta: number) {
        const newOffset = weekOffset + delta
        const newMonday = getMondayStr(newOffset)
        const newSunday = getWeekDays(newMonday)[6].dateStr

        setWeekOffset(newOffset)
        setMondayStr(newMonday)

        // Re-fetch events and tasks for the new week
        try {
            const [newEvents, newUnplanned] = await Promise.all([
                getEventsByDateRange(newMonday, newSunday),
                getUnplannedTasks()
            ])
            setEvents(newEvents || [])
            setUnplanned(newUnplanned || [])
        } catch (e) {
            console.error('Error fetching week data:', e)
        }
    }

    function getWeekLabel(): string {
        if (weekOffset === 0) return 'Esta semana'
        if (weekOffset === 1) return 'Próxima semana'
        if (weekOffset === -1) return 'Semana pasada'
        const start = weekDays[0].dateStr.slice(5).replace('-', '/')
        const end = weekDays[6].dateStr.slice(5).replace('-', '/')
        return `${start} — ${end}`
    }

    // ─── Task Actions ─────────────────────────────────────────────────
    async function handleAssignToDay(taskId: string, dayDate: string) {
        setUnplanned(prev => prev.filter(t => t.id !== taskId))
        setTasks(prev => {
            const existing = prev.find(t => t.id === taskId)
            if (existing) return prev.map(t => t.id === taskId ? { ...t, planned_date: dayDate } : t)
            const fromUnplanned = unplanned.find(t => t.id === taskId)
            if (fromUnplanned) return [...prev, { ...fromUnplanned, planned_date: dayDate }]
            return prev
        })
        await assignTaskToDay(taskId, dayDate)
    }

    async function handleUnassign(taskId: string) {
        const task = tasks.find(t => t.id === taskId) || unplanned.find(t => t.id === taskId)
        setTasks(prev => prev.filter(t => t.id !== taskId))
        if (task) setUnplanned(prev => {
            if (prev.find(t => t.id === taskId)) return prev
            return [...prev, { ...task, planned_date: null }]
        })
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

    // ─── DnD Handlers ─────────────────────────────────────────────────
    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id)
    }

    function handleDragOver(event: DragOverEvent) {
        setOverId(event.over?.id ?? null)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        setActiveId(null)
        setOverId(null)

        if (!over) return

        const taskId = active.id as string
        const dropTarget = over.id as string

        if (dropTarget === BACKLOG_DROP_ID) {
            // Drop to backlog
            handleUnassign(taskId)
        } else if (dropTarget.startsWith(DAY_PREFIX)) {
            // Drop to a day column
            const dayDate = dropTarget.slice(DAY_PREFIX.length)
            handleAssignToDay(taskId, dayDate)
        }
    }

    const activeTask = activeId
        ? (tasks.find(t => t.id === activeId) || unplanned.find(t => t.id === activeId))
        : null

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
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

                {/* Week Navigator */}
                <div className="glass p-3 rounded-2xl border border-border/50 flex items-center justify-between gap-3">
                    <button
                        onClick={() => handleChangeWeek(-1)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="text-center">
                        <span className="text-sm font-bold text-white font-heading">{getWeekLabel()}</span>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {weekDays[0].dateStr} — {weekDays[6].dateStr}
                        </p>
                    </div>

                    <button
                        onClick={() => handleChangeWeek(1)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
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
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-w-0">
                    {/* 7 Columns for Days */}
                    <div className="lg:col-span-3 flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:flex overflow-x-auto gap-3 pb-3 custom-scrollbar min-w-0">
                        {weekDays.map((day) => {
                            const dayTasks = tasks.filter(t => t.planned_date === day.dateStr && t.status !== 'Done')
                            const dayEvents = events.filter(ev => ev.event_date === day.dateStr)

                            return (
                                <div key={day.dateStr} className="min-w-[210px] xl:w-[210px] shrink-0">
                                    <WeekColumn
                                        dayName={day.name}
                                        dateStr={day.dateStr}
                                        isToday={day.dateStr === todayStr}
                                        tasks={dayTasks}
                                        events={dayEvents}
                                        onCompleteTask={handleCompleteTask}
                                        onAddTaskToDay={openAddTaskModal}
                                        onUnassignTask={handleUnassign}
                                        dropId={`${DAY_PREFIX}${day.dateStr}`}
                                        isDragOver={overId === `${DAY_PREFIX}${day.dateStr}`}
                                    />
                                </div>
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
                            dropId={BACKLOG_DROP_ID}
                            isDragOver={overId === BACKLOG_DROP_ID}
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

            {/* Drag overlay: floating card */}
            <DragOverlay>
                {activeTask && (
                    <div className="rotate-1 opacity-90 shadow-2xl shadow-indigo-600/30 scale-105">
                        <TaskDragCard
                            task={activeTask}
                            onComplete={() => { }}
                        />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    )
}
