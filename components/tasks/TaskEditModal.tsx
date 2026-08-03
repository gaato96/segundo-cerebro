'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Circle, Trash2, Calendar as CalendarIcon, Flag, Tag, Zap, Bell, CalendarPlus, Save, Loader2 } from 'lucide-react'
import { updateTask, deleteTask, updateTaskStatus } from '@/lib/actions/tasks'
import { getPriorityColor, getPriorityLabel, formatDate, getGoogleCalendarUrl } from '@/lib/utils'
import { SubtaskList } from './SubtaskList'
import { useRouter } from 'next/navigation'

interface TaskEditModalProps {
    task: any | null
    isOpen: boolean
    onClose: () => void
}

export function TaskEditModal({ task, isOpen, onClose }: TaskEditModalProps) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState<number>(2)
    const [category, setCategory] = useState('Personal')
    const [energyLevel, setEnergyLevel] = useState('Deep Work')
    const [dueDate, setDueDate] = useState('')
    const [reminderTime, setReminderTime] = useState('')
    const [status, setStatus] = useState<'Todo' | 'InProgress' | 'Done'>('Todo')

    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (task) {
            setTitle(task.title || '')
            setDescription(task.description || '')
            setPriority(task.priority || 2)
            setCategory(task.category || 'Personal')
            setEnergyLevel(task.energy_level || 'Deep Work')
            setDueDate(task.due_date ? task.due_date.split('T')[0] : '')
            setReminderTime(task.reminder_time ? task.reminder_time.substring(0, 5) : '')
            setStatus(task.status || 'Todo')
        }
    }, [task])

    if (!isOpen || !task) return null

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || loading) return

        setLoading(true)
        try {
            await updateTask(task.id, {
                title: title.trim(),
                description: description.trim() || null,
                priority,
                category,
                energy_level: energyLevel,
                due_date: dueDate || null,
                reminder_time: reminderTime || null,
                status
            })
            router.refresh()
            onClose()
        } catch (error) {
            console.error('Failed to update task:', error)
            alert('Error al guardar los cambios')
        } finally {
            setLoading(false)
        }
    }

    async function handleToggleStatus() {
        const newStatus = status === 'Done' ? 'Todo' : 'Done'
        setStatus(newStatus)
        try {
            await updateTaskStatus(task.id, newStatus)
            router.refresh()
        } catch (err) {
            console.error(err)
        }
    }

    async function handleDelete() {
        if (!confirm('¿Seguro que querés eliminar esta tarea?')) return
        setDeleting(true)
        try {
            await deleteTask(task.id)
            router.refresh()
            onClose()
        } catch (error) {
            console.error('Failed to delete task:', error)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-card w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-border/50 bg-secondary/20">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleToggleStatus}
                                className={`shrink-0 transition-colors ${status === 'Done' ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`}
                            >
                                {status === 'Done' ? (
                                    <div className="w-5 h-5 bg-green-500 text-background rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                    </div>
                                ) : (
                                    <Circle className="w-5 h-5" />
                                )}
                            </button>
                            <span className="text-sm font-semibold text-foreground/80">Editar Tarea</span>
                        </div>

                        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <form id="edit-task-form" onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                        {/* Title */}
                        <div>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="Título de la tarea..."
                                className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-2.5 text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Descripción (opcional)..."
                                className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                            />
                        </div>

                        {/* Grid: Priority, Category, Energy */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <Flag className="w-3 h-3 text-indigo-400" /> Prioridad
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                    className="w-full bg-secondary/40 border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value={1}>🔴 Alta</option>
                                    <option value={2}>🟡 Media</option>
                                    <option value={3}>🔵 Baja</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <Tag className="w-3 h-3 text-indigo-400" /> Área
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-secondary/40 border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="Work">Trabajo</option>
                                    <option value="Personal">Personal</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-indigo-400" /> Energía
                                </label>
                                <select
                                    value={energyLevel}
                                    onChange={(e) => setEnergyLevel(e.target.value)}
                                    className="w-full bg-secondary/40 border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="Deep Work">⚡ Deep</option>
                                    <option value="Low Energy">🔋 Low</option>
                                    <option value="Phone-only">📱 Mobile</option>
                                </select>
                            </div>
                        </div>

                        {/* Dates Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3 text-indigo-400" /> Fecha Límite
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-secondary/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <Bell className="w-3 h-3 text-indigo-400" /> Hora Recordatorio
                                </label>
                                <input
                                    type="time"
                                    value={reminderTime}
                                    onChange={(e) => setReminderTime(e.target.value)}
                                    className="w-full bg-secondary/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Subtasks Section */}
                        <SubtaskList parentTaskId={task.id} />
                    </form>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/50 bg-secondary/20 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Eliminar
                        </button>

                        <div className="flex items-center gap-2">
                            {dueDate && (
                                <a
                                    href={getGoogleCalendarUrl({ title, description, event_date: dueDate, start_time: reminderTime })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-[#4285F4]/10 hover:bg-[#4285F4]/20 text-[#4285F4] rounded-xl text-xs transition-colors"
                                    title="Google Calendar"
                                >
                                    <CalendarPlus className="w-4 h-4" />
                                </a>
                            )}
                            <button
                                type="submit"
                                form="edit-task-form"
                                disabled={loading}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow-md flex items-center gap-1.5"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
