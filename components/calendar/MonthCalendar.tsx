'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { EventItem } from '@/lib/actions/events'
import { EventCard } from './EventCard'
import { getLocalDateStr } from '@/lib/utils'

interface MonthCalendarProps {
    events: EventItem[]
    currentDate: Date
    onMonthChange: (newDate: Date) => void
    onDateSelect: (dateStr: string) => void
    onAddEvent: (dateStr: string) => void
    onEditEvent: (event: EventItem) => void
}

export function MonthCalendar({
    events,
    currentDate,
    onMonthChange,
    onDateSelect,
    onAddEvent,
    onEditEvent
}: MonthCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateStr())

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    // Calculate first day of month (0 = Sunday, 1 = Monday)
    const firstDayIndex = new Date(year, month, 1).getDay()
    // Convert to Monday start (0 = Mon, 6 = Sun)
    const mondayOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1

    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Days from previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const todayStr = getLocalDateStr()

    // Create array of 35 or 42 grid cells
    const gridCells = []

    // Prev month padding
    for (let i = mondayOffset - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i
        const prevMonth = month === 0 ? 11 : month - 1
        const prevYear = month === 0 ? year - 1 : year
        const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        gridCells.push({ day, dateStr, isCurrentMonth: false })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        gridCells.push({ day, dateStr, isCurrentMonth: true })
    }

    // Next month padding
    const remainingCells = (7 - (gridCells.length % 7)) % 7
    for (let day = 1; day <= remainingCells; day++) {
        const nextMonth = month === 11 ? 0 : month + 1
        const nextYear = month === 11 ? year + 1 : year
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        gridCells.push({ day, dateStr, isCurrentMonth: false })
    }

    const prevMonth = () => {
        onMonthChange(new Date(year, month - 1, 1))
    }

    const nextMonth = () => {
        onMonthChange(new Date(year, month + 1, 1))
    }

    // Group events by date
    const eventsByDate = events.reduce((acc, ev) => {
        if (!acc[ev.event_date]) acc[ev.event_date] = []
        acc[ev.event_date].push(ev)
        return acc
    }, {} as Record<string, EventItem[]>)

    const selectedDayEvents = eventsByDate[selectedDate] || []

    return (
        <div className="space-y-6">
            {/* Header & Month Selector */}
            <div className="glass p-4 rounded-2xl border border-border/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-heading font-bold text-white capitalize">
                        {monthNames[month]} {year}
                    </h2>
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 border border-border">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onMonthChange(new Date())}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => onAddEvent(selectedDate)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Evento
                </button>
            </div>

            {/* Grid Calendar */}
            <div className="glass rounded-3xl p-4 md:p-6 border border-border/50 shadow-xl overflow-hidden">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center">
                    {daysOfWeek.map((d) => (
                        <span key={d} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {d}
                        </span>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {gridCells.map((cell) => {
                        const dayEvents = eventsByDate[cell.dateStr] || []
                        const isToday = cell.dateStr === todayStr
                        const isSelected = cell.dateStr === selectedDate

                        return (
                            <div
                                key={cell.dateStr}
                                onClick={() => {
                                    setSelectedDate(cell.dateStr)
                                    onDateSelect(cell.dateStr)
                                }}
                                className={`min-h-[70px] md:min-h-[90px] p-1.5 md:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                                    isSelected
                                        ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg'
                                        : isToday
                                        ? 'bg-indigo-500/10 border-indigo-500/30'
                                        : cell.isCurrentMonth
                                        ? 'bg-secondary/20 border-border/30 hover:bg-secondary/40'
                                        : 'bg-background/20 border-transparent opacity-30'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-bold font-mono rounded-lg w-6 h-6 flex items-center justify-center ${
                                        isToday ? 'bg-indigo-600 text-white shadow-md' : isSelected ? 'text-indigo-300' : 'text-white/80'
                                    }`}>
                                        {cell.day}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                            {dayEvents.length}
                                        </span>
                                    )}
                                </div>

                                {/* Event Dots / Previews */}
                                <div className="space-y-1 mt-1">
                                    {dayEvents.slice(0, 2).map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="text-[10px] font-semibold truncate px-1.5 py-0.5 rounded text-white"
                                            style={{ backgroundColor: `${ev.color_hex}40`, borderLeft: `3px solid ${ev.color_hex}` }}
                                        >
                                            {ev.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 2 && (
                                        <span className="text-[9px] text-muted-foreground block text-right font-semibold">
                                            +{dayEvents.length - 2} más
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Selected Date Details */}
            <div className="glass p-6 rounded-3xl border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-base text-white">
                        Eventos del día ({selectedDate})
                    </h3>
                    <button
                        onClick={() => onAddEvent(selectedDate)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Agregar a este día
                    </button>
                </div>

                {selectedDayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                        No hay eventos registrados para este día.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedDayEvents.map((ev) => (
                            <EventCard key={ev.id} event={ev} onEdit={onEditEvent} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
