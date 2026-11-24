'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRecurringTask, updateRecurringTask } from '@/lib/actions/tasks'
import { X, Loader2, Flag, Tag, Zap, Repeat, Bell } from 'lucide-react'

interface RecurringTaskFormProps {
    onClose: () => void
    /** Si viene, el formulario edita esta plantilla en vez de crear una nueva. */
    task?: any
}

const DAYS_OF_WEEK = [
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mié', value: 3 },
    { label: 'Jue', value: 4 },
    { label: 'Vie', value: 5 },
    { label: 'Sáb', value: 6 },
    { label: 'Dom', value: 7 },
]

export function RecurringTaskForm({ onClose, task }: RecurringTaskFormProps) {
    const isEdit = Boolean(task)
    const [loading, setLoading] = useState(false)
    const [recurrenceType, setRecurrenceType] = useState<string>(task?.recurrence_type || 'weekly')
    const [selectedDays, setSelectedDays] = useState<number[]>(
        task?.recurrence_days?.length ? [...task.recurrence_days].sort() : [1]
    )
    const [interval] = useState<number>(task?.recurrence_interval || 1)
    const router = useRouter()

    function toggleDay(val: number) {
        if (selectedDays.includes(val)) {
            if (selectedDays.length > 1) {
                setSelectedDays(selectedDays.filter(d => d !== val))
            }
        } else {
            setSelectedDays([...selectedDays, val].sort())
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        formData.set('recurrence_type', recurrenceType)
        formData.set('recurrence_days', selectedDays.join(','))
        formData.set('recurrence_interval', interval.toString())

        try {
            if (isEdit) await updateRecurringTask(task.id, formData)
            else await createRecurringTask(formData)
            router.refresh()
            onClose()
        } catch (error) {
            console.error('Failed to create recurring task:', error)
            alert(isEdit ? 'Error al guardar los cambios' : 'Error al crear la tarea recurrente')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background/95">
            <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Repeat className="w-5 h-5 text-indigo-400" />
                        {isEdit ? 'Editar Tarea Recurrente' : 'Nueva Tarea Recurrente'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {isEdit
                            ? 'Los cambios valen para hoy y las próximas. Las pasadas no se tocan.'
                            : 'Se repetirá automáticamente'}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="space-y-5 flex-1 overflow-y-auto p-6">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Título</label>
                        <input
                            autoFocus
                            name="title"
                            type="text"
                            required
                            defaultValue={task?.title || ''}
                            placeholder="Ej. Revisar presupuesto semanal..."
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all text-base"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Descripción (Opcional)</label>
                        <textarea
                            name="description"
                            rows={2}
                            defaultValue={task?.description || ''}
                            placeholder="Detalles o checklist..."
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all resize-none text-sm"
                        />
                    </div>

                    {/* Recurrence Config */}
                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                                Frecuencia de Repetición
                            </label>
                            <select
                                value={recurrenceType}
                                onChange={(e) => setRecurrenceType(e.target.value)}
                                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-foreground"
                            >
                                <option value="daily">Todos los días</option>
                                <option value="weekly">Semanal</option>
                                <option value="biweekly">Cada 2 semanas (Quincenal)</option>
                                <option value="monthly">Mensual</option>
                                <option value="quarterly">Trimestral (Cada 3 meses)</option>
                            </select>
                        </div>

                        {/* Weekly Day Selector */}
                        {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Días que se repite</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {DAYS_OF_WEEK.map((d) => {
                                        const isSelected = selectedDays.includes(d.value)
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => toggleDay(d.value)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* End date */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Fecha de fin (Opcional)</label>
                            <input
                                name="recurrence_end_date"
                                type="date"
                                defaultValue={task?.recurrence_end_date || ''}
                                className="w-full bg-secondary border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 [color-scheme:dark]"
                            />
                        </div>

                        {/* Recordatorio en la PC */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Bell className="w-3.5 h-3.5 text-indigo-400" /> Recordatorio PC (opcional)
                            </label>
                            <input
                                name="reminder_time"
                                type="time"
                                defaultValue={task?.reminder_time ? String(task.reminder_time).slice(0, 5) : ''}
                                className="w-full bg-secondary border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 [color-scheme:dark]"
                            />
                            <p className="text-[11px] text-muted-foreground">Te avisa en la compu a esa hora cada día que toque.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <Flag className="w-3.5 h-3.5 text-indigo-400" /> Prioridad
                            </label>
                            <select
                                name="priority"
                                defaultValue={String(task?.priority || 2)}
                                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                            >
                                <option value="1">Alta (Urgente)</option>
                                <option value="2">Media (Normal)</option>
                                <option value="3">Baja (Backlog)</option>
                            </select>
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-indigo-400" /> Área
                            </label>
                            <select
                                name="category"
                                defaultValue={task?.category || 'Personal'}
                                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                            >
                                <option value="Work">Trabajo</option>
                                <option value="Personal">Personal</option>
                            </select>
                        </div>

                        {/* Energy */}
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-indigo-400" /> Nivel de Energía
                            </label>
                            <select
                                name="energy_level"
                                defaultValue={task?.energy_level || 'Deep Work'}
                                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                            >
                                <option value="Deep Work">Deep Work (Alta Energía)</option>
                                <option value="Low Energy">Low Energy (Baja Energía)</option>
                                <option value="Phone-only">Phone-only (Solo Celular)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 p-6 border-t border-border flex justify-end gap-3 bg-background/95">
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
                        className="bg-raised border border-hairline hover:border-[hsl(var(--hairline-strong))] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Guardar cambios' : 'Guardar Recurrente'}
                    </button>
                </div>
            </form>
        </div>
    )
}
