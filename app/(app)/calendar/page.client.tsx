'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, List, LayoutGrid } from 'lucide-react'
import { PageShell, PageHeader } from '@/components/ui/kit'
import { Segmented } from '@/components/ui/controls'
import { ModuleTabs } from '@/components/layout/ModuleTabs'
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
        <PageShell wide>
            <PageHeader label="Planificar" title="Agenda" subtitle="El mes de un vistazo. Tocá un día para agregar un evento."
                actions={<><ModuleTabs module="agenda" /><Segmented value={viewMode} onChange={setViewMode} options={[{ id: 'month', label: 'Grilla', icon: LayoutGrid }, { id: 'list', label: 'Lista', icon: List }]} /><button onClick={() => openAddModal()} className="btn-primary text-sm">+ Evento</button></>} />

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
                    {events.length === 0 ? (
                        <div className="glass p-8 text-center rounded-2xl border border-hairline">
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
        </PageShell>
    )
}
