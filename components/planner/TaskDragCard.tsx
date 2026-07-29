'use client'

import { motion } from 'framer-motion'
import { Check, Circle, Clock, Tag } from 'lucide-react'
import { getPriorityColor, getPriorityLabel } from '@/lib/utils'

interface TaskDragCardProps {
    task: any
    onComplete: (id: string) => void
    onAssignToDay?: (taskId: string, dayDate: string) => void
    onUnassign?: (taskId: string) => void
}

export function TaskDragCard({ task, onComplete, onUnassign }: TaskDragCardProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            className="group flex flex-col gap-2 p-3 rounded-xl bg-secondary/40 border border-border/50 hover:bg-secondary/70 transition-all text-xs"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                    <button
                        onClick={() => onComplete(task.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-500 transition-colors"
                    >
                        <Circle className="w-4 h-4 group-hover:hidden" />
                        <Check className="w-4 h-4 hidden group-hover:block" />
                    </button>
                    <span className="font-semibold text-white/90 leading-tight">
                        {task.title}
                    </span>
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
        </motion.div>
    )
}
