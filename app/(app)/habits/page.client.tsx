'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Flame, Target, Trash2, X, PlusCircle, Loader2 } from 'lucide-react'
import { createHabit, deleteHabit } from '@/lib/actions/habits'

export function HabitsClient({ habits, logs }: { habits: any[], logs: any[] }) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    // Basic derived state for MVP
    const todayStr = new Date().toISOString().split('T')[0]

    const getCompletionsThisWeek = (habitId: string) => {
        return logs.filter(log => log.habit_id === habitId).length
    }

    const isCompletedToday = (habitId: string) => {
        return logs.some(log =>
            log.habit_id === habitId &&
            log.completed_at.startsWith(todayStr)
        )
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar este hábito?')) return

        setLoading(id)
        try {
            await deleteHabit(id)
        } catch (error) {
            console.error(error)
            alert('Error eliminando hábito')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in relative pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Gestión de Hábitos
                        <Flame className="w-6 h-6 text-orange-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Construí consistencia. Pequeñas acciones, grandes resultados.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/25 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Hábito
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-2xl border border-border/50">
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-orange-400" /> Total
                    </p>
                    <p className="text-2xl font-bold mt-1">{habits.length}</p>
                </div>
                <div className="glass p-4 rounded-2xl border border-border/50">
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-green-400" /> Completados Hoy
                    </p>
                    <p className="text-2xl font-bold mt-1">
                        {habits.filter(h => isCompletedToday(h.id)).length}
                    </p>
                </div>
            </div>

            {/* Habit List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                {habits.length === 0 ? (
                    <div className="col-span-full glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
                            <PlusCircle className="w-8 h-8 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">Sin hábitos</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mb-6">
                            Empezá creando rutinas que te acerquen a tus objetivos.
                        </p>
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="text-orange-500 font-medium hover:text-orange-400"
                        >
                            Crear mi primer hábito →
                        </button>
                    </div>
                ) : (
                    habits.map(habit => {
                        const weekCompletions = getCompletionsThisWeek(habit.id)
                        const isDoneToday = isCompletedToday(habit.id)
                        const progress = Math.min((weekCompletions / habit.goal_count) * 100, 100)

                        return (
                            <motion.div
                                key={habit.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass p-5 rounded-2xl border border-border/50 shadow-sm relative group overflow-hidden"
                            >
                                {/* Accent line */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-1.5"
                                    style={{ backgroundColor: habit.color_hex }}
                                />

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-semibold text-lg">{habit.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Meta: {habit.goal_count}x por semana
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(habit.id)}
                                        disabled={loading === habit.id}
                                        className="p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-500/10"
                                    >
                                        {loading === habit.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Progreso semanal</span>
                                        <span className="font-medium">{weekCompletions}/{habit.goal_count}</span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${progress}%`,
                                                backgroundColor: habit.color_hex
                                            }}
                                        />
                                    </div>
                                </div>

                                {isDoneToday && (
                                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                                        <Flame className="w-3.5 h-3.5" />
                                        Completado hoy
                                    </div>
                                )}
                            </motion.div>
                        )
                    })
                )}
            </div>

            {/* Create Modal overlay */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFormOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Hábito</h2>
                                <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form action={async (formData) => {
                                try {
                                    setLoading('create')
                                    await createHabit(formData)
                                    setIsFormOpen(false)
                                } catch (error) {
                                    alert('Error al crear')
                                } finally {
                                    setLoading(null)
                                }
                            }} className="p-6 space-y-4 overflow-y-auto flex-1">

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nombre del Hábito</label>
                                    <input
                                        required
                                        name="title"
                                        autoFocus
                                        placeholder="Ej. Leer 10 páginas, Meditar 5 min"
                                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Veces por semana</label>
                                        <input
                                            name="goal_count"
                                            type="number"
                                            min="1"
                                            max="7"
                                            defaultValue="7"
                                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Color</label>
                                        <input
                                            name="color_hex"
                                            type="color"
                                            defaultValue="#f97316"
                                            className="w-full h-[46px] bg-secondary/50 border border-border rounded-xl p-1 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <input type="hidden" name="frequency" value="weekly" />

                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
                                        Cancelar
                                    </button>
                                    <button disabled={loading === 'create'} type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center gap-2 min-w-[100px] justify-center">
                                        {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
