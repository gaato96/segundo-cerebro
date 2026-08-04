'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, List, LayoutGrid } from 'lucide-react'
import { EventItem, getEvents } from '@/lib/actions/events'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { EventCard } from '@/components/calendar/EventCard'
import { EventFormModal } from '@/components/calendar/EventFormModal'
import { getLocalDateStr } from '@/lib/utils'

interface CalendarClientProps {
    initialEvents: EventItem[]
    initialMonthYear: string
}

export function CalendarClient({ initialEvents, initialMonthYear }: CalendarClientProps) {
    const [events, setEvents] = useState<EventItem[]>(initialEvents)
    const [viewMode, setViewMode] = useState<'month' | 'list'>('month')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(getLocalDateStr())
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [eventToEdit, setEventToEdit] = useState<EventItem | null>(null)

    async function handleMonthChange(newDate: Date) {
        setCurrentDate(newDate)
        const monthYear = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
        const fetched = await getEvents(monthYear)
        setEvents(fetched)
    }

    const openAddModal = (dateStr?: string) => {
        if (dateStr) setSelectedDate(dateStr)
        setEventToEdit(null)
        setIsModalOpen(true)
    }

    const openEditModal = (event: EventItem) => {
        setEventToEdit(event)
        setIsModalOpen(true)
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Calendario & Eventos
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Organizá tus reuniones, eventos y sincronizá con Google Calendar.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-secondary/50 rounded-xl p-1 border border-border">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                viewMode === 'month' ? 'bg-indigo-600 text-white shadow-md' : 'text-muted-foreground hover:text-white'
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Mes
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-muted-foreground hover:text-white'
                            }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            Lista
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'month' ? (
                <MonthCalendar
                    events={events}
                    currentDate={currentDate}
                    onMonthChange={handleMonthChange}
                    onDateSelect={(d) => setSelectedDate(d)}
                    onAddEvent={(d) => openAddModal(d)}
                    onEditEvent={(ev) => openEditModal(ev)}
                />
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-heading font-bold text-lg text-white">
                            Próximos Eventos
                        </h3>
                        <button
                            onClick={() => openAddModal()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                        >
                            + Nuevo Evento
                        </button>
                    </div>

                    {events.length === 0 ? (
                        <div className="glass p-8 text-center rounded-3xl border border-border/50">
                            <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm font-medium text-white">No hay eventos registrados este mes.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {events.map((ev) => (
                                <EventCard key={ev.id} event={ev} onEdit={openEditModal} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <EventFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                eventToEdit={eventToEdit}
                defaultDate={selectedDate}
            />
        </div>
    )
}
