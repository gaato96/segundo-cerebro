'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Clock, Plus, Users } from 'lucide-react'
import { TaskDragCard } from './TaskDragCard'
import { EventCard } from '@/components/calendar/EventCard'
import { EventItem } from '@/lib/actions/events'

interface WeekColumnProps {
    dayName: string
    dateStr: string
    isToday: boolean
    tasks: any[]
    events: EventItem[]
    onCompleteTask: (id: string) => void
    onAddTaskToDay: (dateStr: string) => void
    onUnassignTask: (taskId: string) => void
}

export function WeekColumn({
    dayName,
    dateStr,
    isToday,
    tasks,
    events,
    onCompleteTask,
    onAddTaskToDay,
    onUnassignTask
}: WeekColumnProps) {
    const formattedDate = dateStr.split('-').slice(1).join('/')

    const totalEstMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 15), 0)
    const hours = Math.floor(totalEstMinutes / 60)
    const mins = totalEstMinutes % 60

    return (
        <div className={`glass rounded-2xl p-3 border flex flex-col min-h-[450px] transition-all ${
            isToday ? 'bg-indigo-600/10 border-indigo-500/40 shadow-lg' : 'border-border/50 bg-secondary/10'
        }`}>
            {/* Column Header */}
            <div className="pb-3 mb-3 border-b border-white/5 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-indigo-400' : 'text-white/80'}`}>
                            {dayName}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                            {formattedDate}
                        </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5 text-indigo-400" />
                        {hours > 0 ? `${hours}h ` : ''}{mins}m est.
                    </span>
                </div>

                <button
                    onClick={() => onAddTaskToDay(dateStr)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5"
                    title="Planificar tarea en este día"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Events / Meetings Section (Informativo) */}
            {events.length > 0 && (
                <div className="space-y-1.5 mb-3">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" /> Reuniones & Eventos ({events.length})
                    </span>
                    {events.map((ev) => (
                        <EventCard key={ev.id} event={ev} compact />
                    ))}
                </div>
            )}

            {/* Tasks Section */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-2 border border-dashed border-white/5 rounded-xl">
                        <p className="text-[11px] text-muted-foreground italic">Sin tareas planificadas</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskDragCard
                            key={task.id}
                            task={task}
                            onComplete={onCompleteTask}
                            onUnassign={onUnassignTask}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
