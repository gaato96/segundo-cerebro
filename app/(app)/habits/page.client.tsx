'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Flame, Plus, Clock, Check, Sun, Sunset, Moon, Sparkles,
    TrendingUp, Calendar, Trash2, Edit2, X, Loader2, RefreshCw
} from 'lucide-react'
import { HabitItem, HabitLogItem, createHabit, updateHabit, deleteHabit } from '@/lib/actions/habits'
import { isHabitScheduledForDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface HabitsClientProps {
    initialHabits: HabitItem[]
    initialLogs: HabitLogItem[]
    monthlyStats: { completionRate: number; activeHabitsCount: number; totalLogsMonth: number }
}

const DAYS_ISO = [
    { iso: 1, label: 'L' },
    { iso: 2, label: 'M' },
    { iso: 3, label: 'X' },
    { iso: 4, label: 'J' },
    { iso: 5, label: 'V' },
    { iso: 6, label: 'S' },
    { iso: 7, label: 'D' },
]

function frequencyLabel(h: HabitItem): string {
    const ft = h.frequency_type || 'daily'
    if (ft === 'daily') return 'Diario'
    if (ft === 'x_per_day') return `${h.frequency_times_per_day}× por día`
    if (ft === 'custom_days') {
        if (!h.frequency_days?.length) return 'Sin días'
        const map: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
        return h.frequency_days.map(d => map[d] || d).join(' · ')
    }
    return 'Diario'
}

export function HabitsClient({ initialHabits, initialLogs, monthlyStats }: HabitsClientProps) {
    const [habits, setHabits] = useState<HabitItem[]>(initialHabits)
    const [logs, setLogs] = useState<HabitLogItem[]>(initialLogs)
    const [sortBy, setSortBy] = useState<'time_asc' | 'time_desc' | 'tod'>('tod')
    const [showOnlyToday, setShowOnlyToday] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [habitToEdit, setHabitToEdit] = useState<HabitItem | null>(null)

    // Form states
    const [title, setTitle] = useState('')
    const [estimatedMinutes, setEstimatedMinutes] = useState(15)
    const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning')
    const [colorHex, setColorHex] = useState('#6366f1')
    const [frequencyType, setFrequencyType] = useState<'daily' | 'custom_days' | 'x_per_week' | 'x_per_day'>('daily')
    const [frequencyDays, setFrequencyDays] = useState<number[]>([])
    const [frequencyTimesPerDay, setFrequencyTimesPerDay] = useState(1)
    const [loading, setLoading] = useState(false)

    const supabase = createClient()
    const todayStr = new Date().toISOString().split('T')[0]

    // Completed today helper
    const completedTodayIds = new Set(
        logs.filter(l => l.completed_at.startsWith(todayStr)).map(l => l.habit_id)
    )

    async function handleToggleHabit(habitId: string) {
        const isDone = completedTodayIds.has(habitId)

        if (isDone) {
            setLogs(prev => prev.filter(l => !(l.habit_id === habitId && l.completed_at.startsWith(todayStr))))
            await supabase.from('habit_logs').delete().eq('habit_id', habitId).gte('completed_at', `${todayStr}T00:00:00-03:00`)
        } else {
            const newLog = { id: Date.now().toString(), habit_id: habitId, user_id: '', completed_at: new Date().toISOString() }
            setLogs(prev => [...prev, newLog])
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
            await supabase.from('habit_logs').insert({ habit_id: habitId })
        }
    }

    function openCreateModal() {
        setHabitToEdit(null)
        setTitle('')
        setEstimatedMinutes(15)
        setTimeOfDay('morning')
        setColorHex('#6366f1')
        setFrequencyType('daily')
        setFrequencyDays([])
        setFrequencyTimesPerDay(1)
        setIsModalOpen(true)
    }

    function openEditModal(h: HabitItem) {
        setHabitToEdit(h)
        setTitle(h.title)
        setEstimatedMinutes(h.estimated_minutes || 15)
        setTimeOfDay(h.time_of_day || 'morning')
        setColorHex(h.color_hex || '#6366f1')
        setFrequencyType(h.frequency_type || 'daily')
        setFrequencyDays(h.frequency_days || [])
        setFrequencyTimesPerDay(h.frequency_times_per_day || 1)
        setIsModalOpen(true)
    }

    function toggleDay(iso: number) {
        setFrequencyDays(prev =>
            prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort()
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        const formData = new FormData()
        formData.append('title', title)
        formData.append('estimated_minutes', estimatedMinutes.toString())
        formData.append('time_of_day', timeOfDay)
        formData.append('color_hex', colorHex)
        formData.append('frequency_type', frequencyType)
        formData.append('frequency_days', frequencyDays.join(','))
        formData.append('frequency_times_per_day', frequencyTimesPerDay.toString())

        if (habitToEdit) {
            await updateHabit(habitToEdit.id, formData)
        } else {
            await createHabit(formData)
        }
        setLoading(false)
        setIsModalOpen(false)
        window.location.reload()
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este hábito?')) return
        await deleteHabit(id)
        setHabits(prev => prev.filter(h => h.id !== id))
    }

    // Filter: only today's scheduled habits
    const visibleHabits = showOnlyToday
        ? habits.filter(h => isHabitScheduledForDate(h, todayStr))
        : habits

    const sortedHabits = [...visibleHabits].sort((a, b) => {
        if (sortBy === 'time_asc') return (a.estimated_minutes || 15) - (b.estimated_minutes || 15)
        if (sortBy === 'time_desc') return (b.estimated_minutes || 15) - (a.estimated_minutes || 15)
        return 0
    })

    const todayScheduledTotal = habits.filter(h => isHabitScheduledForDate(h, todayStr)).length
    const totalEstMinutesDaily = habits.reduce((sum, h) => sum + (h.estimated_minutes || 15), 0)

    const getTimeOfDayIcon = (tod: string) => {
        switch (tod) {
            case 'morning': return <Sun className="w-4 h-4 text-amber-400" />
            case 'afternoon': return <Sunset className="w-4 h-4 text-orange-400" />
            case 'evening': return <Moon className="w-4 h-4 text-indigo-400" />
            default: return <Clock className="w-4 h-4 text-muted-foreground" />
        }
    }

    const getTimeOfDayLabel = (tod: string) => {
        switch (tod) {
            case 'morning': return 'Mañana'
            case 'afternoon': return 'Tarde'
            case 'evening': return 'Noche'
            default: return 'Cualquier momento'
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Panel de Hábitos
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Medí tu consistencia, optimizá tu tiempo y construí rutinas sólidas.
                    </p>
                </div>

                <button
                    onClick={openCreateModal}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Hábito
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-indigo-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tasa del Mes</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{monthlyStats.completionRate}%</h3>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Consistencia mensual
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-orange-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Completados Hoy</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{completedTodayIds.size} / {todayScheduledTotal}</h3>
                    <p className="text-[10px] text-orange-400 mt-1 font-semibold flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Hábitos de hoy
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-purple-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tiempo Diario Est.</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{totalEstMinutesDaily} min</h3>
                    <p className="text-[10px] text-purple-400 mt-1 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~{(totalEstMinutesDaily / 60).toFixed(1)} horas/día
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-emerald-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Registros del Mes</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{monthlyStats.totalLogsMonth}</h3>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Hábitos cumplidos
                    </p>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="glass p-4 rounded-2xl border border-border/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ordenar por:</span>
                    <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="tod">Momento del día (Mañana → Noche)</option>
                        <option value="time_asc">Duración (Menor a Mayor)</option>
                        <option value="time_desc">Duración (Mayor a Menor)</option>
                    </select>
                </div>

                <button
                    onClick={() => setShowOnlyToday(!showOnlyToday)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${showOnlyToday
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'
                        }`}
                >
                    <Calendar className="w-3.5 h-3.5" />
                    {showOnlyToday ? 'Mostrando hoy' : 'Solo hoy'}
                </button>
            </div>

            {/* Habits List */}
            <div className="space-y-3">
                {sortedHabits.map((h) => {
                    const isDone = completedTodayIds.has(h.id)
                    const scheduledToday = isHabitScheduledForDate(h, todayStr)

                    return (
                        <div
                            key={h.id}
                            className={`glass rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDone ? 'bg-emerald-500/5 border-emerald-500/30' : 'border-border/50 hover:bg-secondary/40'
                                }`}
                            style={{ borderLeftWidth: 4, borderLeftColor: h.color_hex }}
                        >
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleHabit(h.id)}
                                    disabled={!scheduledToday}
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all shrink-0 ${isDone
                                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                                        : scheduledToday
                                            ? 'bg-black/30 border-white/20 text-transparent hover:border-emerald-500'
                                            : 'bg-black/20 border-white/10 text-transparent opacity-40 cursor-not-allowed'
                                        }`}
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <div>
                                    <h4 className={`text-base font-bold font-heading ${isDone ? 'line-through text-muted-foreground' : 'text-white'}`}>
                                        {h.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            {getTimeOfDayIcon(h.time_of_day)}
                                            {getTimeOfDayLabel(h.time_of_day)}
                                        </span>
                                        <span className="text-xs text-indigo-300 font-mono flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {h.estimated_minutes || 15} min
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-1 font-semibold">
                                            <RefreshCw className="w-2.5 h-2.5" />
                                            {frequencyLabel(h)}
                                        </span>
                                        {!scheduledToday && (
                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                                                No es hoy
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button
                                    onClick={() => openEditModal(h)}
                                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(h.id)}
                                    className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )
                })}

                {sortedHabits.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground text-sm">
                        {showOnlyToday ? 'No hay hábitos programados para hoy.' : 'Creá tu primer hábito con el botón de arriba.'}
                    </div>
                )}
            </div>

            {/* Modal Create/Edit */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass border border-border/50 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">
                                    {habitToEdit ? 'Editar Hábito' : 'Nuevo Hábito'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        Nombre del Hábito *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ej: Meditar 10 minutos, Leer..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Frequency Type */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                                        Frecuencia
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { value: 'daily', label: '🔁 Diario' },
                                            { value: 'custom_days', label: '📅 Días específicos' },
                                            { value: 'x_per_day', label: '🎯 X veces/día' },
                                        ] as const).map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setFrequencyType(opt.value)}
                                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left ${frequencyType === opt.value
                                                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                                                    : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Days picker */}
                                    {frequencyType === 'custom_days' && (
                                        <div className="mt-3">
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-2">
                                                Seleccioná los días
                                            </label>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {DAYS_ISO.map(({ iso, label }) => (
                                                    <button
                                                        key={iso}
                                                        type="button"
                                                        onClick={() => toggleDay(iso)}
                                                        className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all ${frequencyDays.includes(iso)
                                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                                            : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* X times per day */}
                                    {frequencyType === 'x_per_day' && (
                                        <div className="mt-3">
                                            <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                                                Cantidad de veces por día
                                            </label>
                                            <input
                                                type="number"
                                                min={2}
                                                max={20}
                                                value={frequencyTimesPerDay}
                                                onChange={e => setFrequencyTimesPerDay(parseInt(e.target.value) || 2)}
                                                className="w-24 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Duration + Time of Day */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                            Duración (min)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={estimatedMinutes}
                                            onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 15)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                            Momento del Día
                                        </label>
                                        <select
                                            value={timeOfDay}
                                            onChange={(e: any) => setTimeOfDay(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="morning">🌅 Mañana</option>
                                            <option value="afternoon">☀️ Tarde</option>
                                            <option value="evening">🌙 Noche</option>
                                            <option value="anytime">⏰ Cualquier momento</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        Color Identificador
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setColorHex(c)}
                                                className={`w-7 h-7 rounded-full border-2 transition-transform ${colorHex === c ? 'scale-110 border-white' : 'border-transparent'
                                                    }`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Hábito'}
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
