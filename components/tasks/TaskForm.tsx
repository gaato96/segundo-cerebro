'use client'

import { useState } from 'react'
import { createTask } from '@/lib/actions/tasks'
import { X, Loader2, Calendar as CalendarIcon, Flag, Tag } from 'lucide-react'

interface TaskFormProps {
    onClose: () => void
}

export function TaskForm({ onClose }: TaskFormProps) {
    const [loading, setLoading] = useState(false)

    async function action(formData: FormData) {
        setLoading(true)
        try {
            await createTask(formData)
            onClose()
        } catch (error) {
            console.error('Failed to create task:', error)
            alert('Error al crear la tarea')
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background/95 backdrop-blur-xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                    <h2 className="text-xl font-heading font-bold">Nueva Tarea</h2>
                    <p className="text-sm text-muted-foreground mt-1">¿Qué tenés en mente?</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form action={action} className="flex-1 flex flex-col min-h-0">
                <div className="space-y-6 flex-1 overflow-y-auto p-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium text-foreground">
                            Título
                        </label>
                        <input
                            autoFocus
                            id="title"
                            name="title"
                            type="text"
                            required
                            placeholder="Ej. Revisar presupuesto Q3..."
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-base"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label htmlFor="description" className="text-sm font-medium text-foreground">
                            Descripción (Opcional)
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            rows={3}
                            placeholder="Detalles adicionales, links, contexto..."
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Priority */}
                        <div className="space-y-2">
                            <label htmlFor="priority" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Flag className="w-3.5 h-3.5" />
                                Prioridad
                            </label>
                            <div className="relative">
                                <select
                                    id="priority"
                                    name="priority"
                                    defaultValue="2"
                                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-foreground"
                                >
                                    <option value="1">Alta (Urgente)</option>
                                    <option value="2">Media (Normal)</option>
                                    <option value="3">Baja (Backlog)</option>
                                </select>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label htmlFor="category" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
                                Área
                            </label>
                            <div className="relative">
                                <select
                                    id="category"
                                    name="category"
                                    defaultValue="Personal"
                                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-foreground"
                                >
                                    <option value="Work">Trabajo</option>
                                    <option value="Personal">Personal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2">
                        <label htmlFor="due_date" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Fecha para hacerlo
                        </label>
                        <input
                            id="due_date"
                            name="due_date"
                            type="date"
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-foreground [color-scheme:dark]"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 p-6 border-t border-border flex justify-end gap-3 bg-background/95 pb-24 md:pb-6 mt-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary text-foreground text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    )
}
