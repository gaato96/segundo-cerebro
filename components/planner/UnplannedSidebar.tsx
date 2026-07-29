'use client'

import { useState } from 'react'
import { CheckSquare, ArrowRight, Plus } from 'lucide-react'
import { TaskDragCard } from './TaskDragCard'

interface UnplannedSidebarProps {
    tasks: any[]
    weekDays: { name: string; dateStr: string }[]
    onAssignToDay: (taskId: string, dateStr: string) => void
    onCompleteTask: (id: string) => void
    onAddNewTask: () => void
}

export function UnplannedSidebar({
    tasks,
    weekDays,
    onAssignToDay,
    onCompleteTask,
    onAddNewTask
}: UnplannedSidebarProps) {
    const [selectedTask, setSelectedTask] = useState<string | null>(null)

    return (
        <div className="glass rounded-3xl p-4 border border-border/50 flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-heading font-bold text-sm text-white">Backlog Sin Planificar</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                    {tasks.length}
                </span>
            </div>

            <button
                onClick={onAddNewTask}
                className="w-full py-2 border border-dashed border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 font-semibold"
            >
                <Plus className="w-3.5 h-3.5" />
                Crear Tarea Rápidamente
            </button>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {tasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                        ¡Genial! No tenés tareas pendientes sin planificar.
                    </div>
                ) : (
                    tasks.map((task) => {
                        const isSelected = selectedTask === task.id
                        return (
                            <div key={task.id} className="space-y-1.5">
                                <div onClick={() => setSelectedTask(isSelected ? null : task.id)}>
                                    <TaskDragCard
                                        task={task}
                                        onComplete={onCompleteTask}
                                    />
                                </div>

                                {isSelected && (
                                    <div className="p-2 rounded-xl bg-black/30 border border-indigo-500/30 space-y-1 animate-fade-in">
                                        <span className="text-[10px] font-semibold text-indigo-300 block">Asignar a un día:</span>
                                        <div className="grid grid-cols-4 gap-1">
                                            {weekDays.map((d) => (
                                                <button
                                                    key={d.dateStr}
                                                    onClick={() => {
                                                        onAssignToDay(task.id, d.dateStr)
                                                        setSelectedTask(null)
                                                    }}
                                                    className="px-1.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded text-[10px] font-semibold transition-all text-center truncate"
                                                >
                                                    {d.name.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
