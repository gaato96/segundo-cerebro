'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Circle, Trash2, Plus, Loader2, ListChecks } from 'lucide-react'
import { getSubtasks, createSubtask, toggleSubtask, deleteSubtask } from '@/lib/actions/tasks'
import { useRouter } from 'next/navigation'

interface SubtaskListProps {
    parentTaskId: string
    onUpdate?: () => void
}

export function SubtaskList({ parentTaskId, onUpdate }: SubtaskListProps) {
    const [subtasks, setSubtasks] = useState<any[]>([])
    const [newTitle, setNewTitle] = useState('')
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState(false)
    const router = useRouter()

    async function loadSubtasks() {
        setLoading(true)
        try {
            const data = await getSubtasks(parentTaskId)
            setSubtasks(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSubtasks()
    }, [parentTaskId])

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        if (!newTitle.trim() || adding) return

        setAdding(true)
        try {
            await createSubtask(parentTaskId, newTitle.trim())
            setNewTitle('')
            await loadSubtasks()
            onUpdate?.()
            router.refresh()
        } catch (err) {
            console.error(err)
        } finally {
            setAdding(false)
        }
    }

    async function handleToggle(id: string, currentStatus: string) {
        setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: currentStatus === 'Done' ? 'Todo' : 'Done' } : s))
        try {
            await toggleSubtask(id, currentStatus)
            onUpdate?.()
            router.refresh()
        } catch (err) {
            console.error(err)
            loadSubtasks()
        }
    }

    async function handleDelete(id: string) {
        setSubtasks(prev => prev.filter(s => s.id !== id))
        try {
            await deleteSubtask(id)
            onUpdate?.()
            router.refresh()
        } catch (err) {
            console.error(err)
            loadSubtasks()
        }
    }

    const completedCount = subtasks.filter(s => s.status === 'Done').length
    const totalCount = subtasks.length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
        <div className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-indigo-400" />
                    Subtareas {totalCount > 0 && `(${completedCount}/${totalCount})`}
                </label>
                {totalCount > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">{progressPct}%</span>
                )}
            </div>

            {/* Progress Bar */}
            {totalCount > 0 && (
                <div className="w-full bg-secondary/80 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        className="bg-indigo-500 h-full rounded-full transition-all"
                    />
                </div>
            )}

            {/* Subtask Items */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {loading && subtasks.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Cargando subtareas...
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {subtasks.map((sub) => {
                            const isDone = sub.status === 'Done'
                            return (
                                <motion.div
                                    key={sub.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-border/30 group transition-all"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(sub.id, sub.status)}
                                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                                    >
                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                                            isDone ? 'bg-green-500 border-green-500 text-background' : 'border-border hover:border-indigo-400'
                                        }`}>
                                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <span className={`text-xs font-medium transition-all truncate ${
                                            isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                                        }`}>
                                            {sub.title}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(sub.id)}
                                        className="text-muted-foreground hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Inline Add Input */}
            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Añadir subtarea..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
                <button
                    type="submit"
                    disabled={!newTitle.trim() || adding}
                    className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1"
                >
                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Agregar
                </button>
            </form>
        </div>
    )
}
