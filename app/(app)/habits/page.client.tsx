'use client'

import { toggleHabitToday } from '@/lib/actions/today'
import { HabitClock } from '@/components/habits/HabitClock'
import { HabitMatrix } from '@/components/habits/HabitMatrix'
import { PageShell, PageHeader } from '@/components/ui/kit'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Flame, Plus, Clock, Check, Sun, Sunset, Moon, Sparkles,
    TrendingUp, Calendar, Trash2, Edit2, X, Loader2, RefreshCw, Wand2, Link2
} from 'lucide-react'
import {
    HabitItem, HabitLogItem, createHabit, updateHabit, deleteHabit,
    suggestHabits, createHabitFromSuggestion, type HabitSuggestion
} from '@/lib/actions/habits'
import { isHabitScheduledForDate, getLocalDateStr, getWeekStartStr, addDaysToDateStr } from '@/lib/utils'

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
    if (ft === 'x_per_week') return `${h.frequency_times_per_week || 3}× por semana`
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
    const [reminderTime, setReminderTime] = useState('')
    const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning')
    const [colorHex, setColorHex] = useState('#7C9CBF')
    const [frequencyType, setFrequencyType] = useState<'daily' | 'custom_days' | 'x_per_week' | 'x_per_day'>('daily')
    const [frequencyDays, setFrequencyDays] = useState<number[]>([])
    const [frequencyTimesPerDay, setFrequencyTimesPerDay] = useState(1)
    const [frequencyTimesPerWeek, setFrequencyTimesPerWeek] = useState(3)
    const [autoSource, setAutoSource] = useState<string>('')
    const [loading, setLoading] = useState(false)

    // --- Hábitos que propone la IA ---
    const [suggesting, setSuggesting] = useState(false)
    const [suggestions, setSuggestions] = useState<HabitSuggestion[] | null>(null)
    const [suggestError, setSuggestError] = useState('')
    const [addingIdx, setAddingIdx] = useState<number | null>(null)

    const todayStr = getLocalDateStr()

    // Completed today helper
    const completedTodayIds = new Set(
        logs.filter(l => getLocalDateStr(new Date(l.completed_at)) === todayStr).map(l => l.habit_id)
    )

    // Los hábitos "X veces por semana" no se miden por día sino por cupo:
    // la semana arranca el lunes y lo que importa es llegar al número.
    const weekStart = getWeekStartStr(todayStr)
    const weekEnd = addDaysToDateStr(weekStart, 6)

    function weeklyCount(habitId: string) {
        return logs.filter(l => {
            const d = getLocalDateStr(new Date(l.completed_at))
            return l.habit_id === habitId && d >= weekStart && d <= weekEnd
        }).length
    }

    async function handleSuggestHabits() {
        setSuggesting(true)
        setSuggestError('')
        try {
            const res = await suggestHabits()
            if (!res.ok) {
                setSuggestError(res.error)
                return
            }
            setSuggestions(res.data)
        } catch (e: any) {
            setSuggestError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setSuggesting(false)
        }
    }

    async function handleAddSuggestion(suggestion: HabitSuggestion, idx: number) {
        setAddingIdx(idx)
        const res = await createHabitFromSuggestion(suggestion)
        setAddingIdx(null)
        if ('error' in res && res.error) return alert(res.error)
        setSuggestions(prev => (prev || []).filter((_, i) => i !== idx))
        window.location.reload()
    }

    async function handleToggleHabit(habitId: string) {
        const isDone = completedTodayIds.has(habitId)
        const before = logs
        setLogs(prev => isDone
            ? prev.filter(l => !(l.habit_id === habitId && getLocalDateStr(new Date(l.completed_at)) === todayStr))
            : [...prev, { id: `tmp-${habitId}`, habit_id: habitId, user_id: '', completed_at: new Date().toISOString() }])
        const res = await toggleHabitToday(habitId, !isDone)
        if (res.error) {
            setLogs(before)
            alert(`No se pudo guardar: ${res.error}`)
        }
    }

    function openCreateModal() {
        setHabitToEdit(null)
        setTitle('')
        setEstimatedMinutes(15)
        setReminderTime('')
        setTimeOfDay('morning')
        setColorHex('#7C9CBF')
        setFrequencyType('daily')
        setFrequencyDays([])
        setFrequencyTimesPerDay(1)
        setFrequencyTimesPerWeek(3)
        setAutoSource('')
        setIsModalOpen(true)
    }

    function openEditModal(h: HabitItem) {
        setHabitToEdit(h)
        setTitle(h.title)
        setEstimatedMinutes(h.estimated_minutes || 15)
        setReminderTime(h.reminder_time ? String(h.reminder_time).slice(0, 5) : '')
        setTimeOfDay(h.time_of_day || 'morning')
        setColorHex(h.color_hex || '#7C9CBF')
        setFrequencyType(h.frequency_type || 'daily')
        setFrequencyDays(h.frequency_days || [])
        setFrequencyTimesPerDay(h.frequency_times_per_day || 1)
        setFrequencyTimesPerWeek(h.frequency_times_per_week || 3)
        setAutoSource((h as any).auto_source || '')
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
        formData.append('reminder_time', reminderTime)
        formData.append('color_hex', colorHex)
        formData.append('frequency_type', frequencyType)
        formData.append('frequency_days', frequencyDays.join(','))
        formData.append('frequency_times_per_day', frequencyTimesPerDay.toString())
        formData.append('frequency_times_per_week', frequencyTimesPerWeek.toString())
        if (habitToEdit) formData.append('auto_source', autoSource)

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
        <PageShell wide className="space-y-6">
            <PageHeader
                label={new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())}
                title="Hábitos"
                subtitle="La matriz del mes: lo que hiciste, lo que tocaba y tu racha."
                actions={
                    <button onClick={openCreateModal} className="btn-primary text-sm">
                        <Plus className="w-4 h-4" /> Nuevo hábito
                    </button>
                }
            />

            {/* Resumen en una tira, sin tarjetas */}
            <div className="flex flex-wrap items-stretch rounded-2xl bg-card border border-hairline divide-x divide-hairline">
                {[
                    { label: 'Hoy', value: `${completedTodayIds.size}/${todayScheduledTotal}` },
                    { label: 'Consistencia del mes', value: `${monthlyStats.completionRate}%` },
                    { label: 'Registros del mes', value: String(monthlyStats.totalLogsMonth) },
                    { label: 'Tiempo diario', value: `${totalEstMinutesDaily} min` }
                ].map(k => (
                    <div key={k.label} className="flex-1 min-w-[140px] px-5 py-4">
                        <p className="label-caps !text-[11px]">{k.label}</p>
                        <p className="font-mono text-2xl mt-1">{k.value}</p>
                    </div>
                ))}
            </div>

            <HabitMatrix habits={habits} logs={logs} todayStr={todayStr} onToggleToday={handleToggleHabit} />

            <section>
                <h2 className="label-caps mb-3">Hoy, por momento del día</h2>
                <HabitClock habits={habits.filter(h => h.is_active && isHabitScheduledForDate(h, todayStr))} done={completedTodayIds} onToggle={handleToggleHabit} />
            </section>

            {/* El coach propone hábitos nuevos mirando todo el contexto */}
            <div className="glass p-5 rounded-2xl border border-hairline space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-white">
                            ¿Qué hábito me convendría sumar?
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            La IA mira tus objetivos, lo que venís cumpliendo y lo que se te cae, y propone 3.
                        </p>
                    </div>
                    <button
                        onClick={handleSuggestHabits}
                        disabled={suggesting}
                        className="px-4 py-2.5 bg-raised border border-hairline hover:border-[hsl(var(--hairline-strong))] text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60 shrink-0"
                    >
                        {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {suggesting ? 'Leyendo tus datos…' : 'Recomendame hábitos'}
                    </button>
                </div>

                {suggestError && (
                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 leading-relaxed break-words">
                        No pude recomendarte nada ahora: {suggestError}
                    </p>
                )}

                {suggestions && suggestions.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-1">
                        {suggestions.map((sug, idx) => (
                            <div
                                key={idx}
                                className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50 space-y-2 flex flex-col"
                                style={{ borderLeftWidth: 4, borderLeftColor: sug.color_hex }}
                            >
                                <h4 className="text-sm font-bold text-white leading-snug">{sug.title}</h4>

                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-semibold">
                                        {sug.frequency_type === 'x_per_week'
                                            ? `${sug.frequency_times_per_week}× por semana`
                                            : sug.frequency_type === 'x_per_day'
                                                ? `${sug.frequency_times_per_day}× por día`
                                                : sug.frequency_type === 'custom_days'
                                                    ? sug.frequency_days.map(d => DAYS_ISO.find(x => x.iso === d)?.label).join(' · ')
                                                    : 'Diario'}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-hairline text-muted-foreground">
                                        {sug.estimated_minutes} min
                                    </span>
                                </div>

                                <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{sug.why}</p>

                                {sug.minimum_version && (
                                    <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                                        <strong className="text-amber-200">En el peor día:</strong> {sug.minimum_version}
                                    </p>
                                )}

                                {sug.anchor && (
                                    <p className="text-[11px] text-sky-300/90 flex items-start gap-1">
                                        <Link2 className="w-3 h-3 shrink-0 mt-0.5" />
                                        {sug.anchor}
                                    </p>
                                )}

                                <div className="flex gap-1.5 pt-1">
                                    <button
                                        onClick={() => handleAddSuggestion(sug, idx)}
                                        disabled={addingIdx === idx}
                                        className="flex-1 py-2 bg-raised border border-hairline hover:border-[hsl(var(--hairline-strong))] text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        {addingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                        Sumarlo
                                    </button>
                                    <button
                                        onClick={() => setSuggestions(prev => (prev || []).filter((_, i) => i !== idx))}
                                        className="px-2.5 py-2 bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground rounded-lg text-[11px] font-semibold"
                                    >
                                        No
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="label-caps">Todos tus hábitos</h2>
                <div className="flex gap-2">
                    <select aria-label="Ordenar" value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} className="field !w-auto text-xs">
                        <option value="tod">Por momento del día</option>
                        <option value="time_asc">Los más cortos primero</option>
                        <option value="time_desc">Los más largos primero</option>
                    </select>
                    <button onClick={() => setShowOnlyToday(!showOnlyToday)} aria-pressed={showOnlyToday} className="btn-secondary whitespace-nowrap"><Calendar className="w-4 h-4" /> {showOnlyToday ? 'Ver todos' : 'Solo hoy'}</button>
                </div>
            </div>

            {/* Habits List */}
            <div className="rounded-2xl border border-hairline bg-card divide-y divide-hairline overflow-hidden">
                {sortedHabits.map((h) => {
                    const isDone = completedTodayIds.has(h.id)
                    const scheduledToday = isHabitScheduledForDate(h, todayStr)

                    return (
                        <div
                            key={h.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleHabit(h.id)}
                                    disabled={!scheduledToday}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all shrink-0 ${isDone
                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                        : scheduledToday
                                            ? 'bg-black/30 border-white/20 text-transparent hover:border-emerald-500'
                                            : 'bg-black/20 border-hairline text-transparent opacity-40 cursor-not-allowed'
                                        }`}
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <div>
                                    <h4 className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-white'}`}>
                                        {h.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            {getTimeOfDayIcon(h.time_of_day)}
                                            {getTimeOfDayLabel(h.time_of_day)}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {h.estimated_minutes || 15} min
                                        </span>
                                        {h.reminder_time && (
                                            <span className="text-xs text-amber-300 font-mono flex items-center gap-1" title="Recordatorio en la PC">
                                                {String(h.reminder_time).slice(0, 5)}
                                            </span>
                                        )}
                                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-hairline text-muted-foreground flex items-center gap-1 font-semibold">
                                            <RefreshCw className="w-2.5 h-2.5" />
                                            {frequencyLabel(h)}
                                        </span>
                                        {(h as any).auto_source && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-300 font-semibold" title="Se tilda solo al registrar lo relacionado">
                                                automático
                                            </span>
                                        )}
                                        {h.frequency_type === 'x_per_week' && (() => {
                                            const done = weeklyCount(h.id)
                                            const target = h.frequency_times_per_week || 3
                                            const complete = done >= target
                                            return (
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                                                    complete
                                                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                                        : 'border-hairline text-muted-foreground'
                                                }`}>
                                                    {done}/{target} esta semana{complete ? ' · cupo cumplido' : ''}
                                                </span>
                                            )
                                        })()}
                                        {!scheduledToday && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-hairline text-muted-foreground">
                                                No es hoy
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button
                                    onClick={() => openEditModal(h)}
                                    className="p-2 rounded-xl bg-white/5 border border-hairline text-muted-foreground hover:text-white hover:bg-white/10"
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
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass border border-hairline w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-hairline pb-3">
                                <h3 className="font-semibold text-lg text-white">
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
                                        className="w-full bg-black/20 border border-hairline rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                    />
                                </div>

                                {/* Se tilda solo */}
                                {habitToEdit && (
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                            Se tilda solo cuando…
                                        </label>
                                        <select
                                            value={autoSource}
                                            onChange={(e) => setAutoSource(e.target.value)}
                                            className="w-full bg-black/20 border border-hairline rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                        >
                                            <option value="">Nunca: lo tildo yo</option>
                                            <option value="training">Registro entreno, parque o un partido</option>
                                            <option value="reading">Avanzo páginas en la Biblioteca</option>
                                            <option value="weight">Registro mi peso</option>
                                        </select>
                                    </div>
                                )}

                                {/* Frequency Type */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                                        Frecuencia
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { value: 'daily', label: 'Diario' },
                                            { value: 'custom_days', label: 'Días específicos' },
                                            { value: 'x_per_week', label: 'X veces/semana' },
                                            { value: 'x_per_day', label: 'X veces/día' },
                                        ] as const).map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setFrequencyType(opt.value)}
                                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left ${frequencyType === opt.value
                                                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                                                    : 'bg-black/20 border-hairline text-muted-foreground hover:text-white'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Days picker */}
                                    {frequencyType === 'custom_days' && (
                                        <div className="mt-3">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase block mb-2">
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
                                                            : 'bg-black/20 border-hairline text-muted-foreground hover:text-white'
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* X times per week: no fija días, fija cupo semanal */}
                                    {frequencyType === 'x_per_week' && (
                                        <div className="mt-3">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase block mb-1">
                                                Cantidad de veces por semana
                                            </label>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        onClick={() => setFrequencyTimesPerWeek(n)}
                                                        className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all ${frequencyTimesPerWeek === n
                                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                                            : 'bg-black/20 border-hairline text-muted-foreground hover:text-white'
                                                            }`}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                                Sin día fijo: lo podés marcar cualquier día de la semana hasta completar
                                                el cupo. La semana arranca el lunes.
                                            </p>
                                        </div>
                                    )}

                                    {/* X times per day */}
                                    {frequencyType === 'x_per_day' && (
                                        <div className="mt-3">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase block mb-1">
                                                Cantidad de veces por día
                                            </label>
                                            <input
                                                type="number"
                                                min={2}
                                                max={20}
                                                value={frequencyTimesPerDay}
                                                onChange={e => setFrequencyTimesPerDay(parseInt(e.target.value) || 2)}
                                                className="w-24 bg-black/20 border border-hairline rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
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
                                            className="w-full bg-black/20 border border-hairline rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                            Momento del Día
                                        </label>
                                        <select
                                            value={timeOfDay}
                                            onChange={(e: any) => setTimeOfDay(e.target.value)}
                                            className="w-full bg-black/20 border border-hairline rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                        >
                                            <option value="morning">Mañana</option>
                                            <option value="afternoon">Tarde</option>
                                            <option value="evening">Noche</option>
                                            <option value="anytime">⏰ Cualquier momento</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Recordatorio en la PC */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        Recordatorio PC (opcional)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={reminderTime}
                                            onChange={(e) => setReminderTime(e.target.value)}
                                            className="w-36 bg-black/20 border border-hairline rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 [color-scheme:dark]"
                                        />
                                        {reminderTime && (
                                            <button type="button" onClick={() => setReminderTime('')} className="text-xs text-muted-foreground hover:text-foreground">
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">Te avisa en la compu a esa hora los días que toca, si todavía no lo tildaste.</p>
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                                        Color Identificador
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {['#7C9CBF', '#6FAE8C', '#E0A54B', '#D9735F', '#A8A8B0', '#B8A07A'].map((c) => (
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
                                        className="px-4 py-2 border border-hairline rounded-xl text-xs text-muted-foreground hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2 bg-raised border border-hairline hover:border-[hsl(var(--hairline-strong))] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Hábito'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageShell>
    )
}
