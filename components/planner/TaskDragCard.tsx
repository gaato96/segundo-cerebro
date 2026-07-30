'use client'

import { motion } from 'framer-motion'
import { Check, Circle, Clock, GripVertical } from 'lucide-react'
import { getPriorityColor, getPriorityLabel } from '@/lib/utils'
import { useDraggable } from '@dnd-kit/core'

interface TaskDragCardProps {
    task: any
    onComplete: (id: string) => void
    onAssignToDay?: (taskId: string, dayDate: string) => void
    onUnassign?: (taskId: string) => void
}

export function TaskDragCard({ task, onComplete, onUnassign }: TaskDragCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
        data: { task }
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.4 : 1,
    } : undefined

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex flex-col gap-2 p-3 rounded-xl bg-secondary/40 border transition-all text-xs select-none ${isDragging ? 'border-indigo-500 bg-indigo-500/10 shadow-lg' : 'border-border/50 hover:bg-secondary/70'
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onComplete(task.id)
                        }}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-500 transition-colors"
                    >
                        <Circle className="w-4 h-4 group-hover:hidden" />
                        <Check className="w-4 h-4 hidden group-hover:block" />
                    </button>
                    <span className="font-semibold text-white/90 leading-tight">
                        {task.title}
                    </span>
                </div>

                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-white p-0.5 rounded shrink-0"
                    title="Arrastrar tarea"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                </span>
                {task.category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {task.category}
                    </span>
                )}
                {task.estimated_minutes && (
                    <span className="text-[9px] font-mono text-indigo-300 flex items-center gap-1 ml-auto">
                        <Clock className="w-2.5 h-2.5" />
                        {task.estimated_minutes} min
                    </span>
                )}
            </div>
        </div>
    )
}
