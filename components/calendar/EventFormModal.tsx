'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar as CalendarIcon, Clock, MapPin, Tag, Loader2, ExternalLink } from 'lucide-react'
import { createEvent, updateEvent, deleteEvent, getGoogleCalendarUrl, EventItem } from '@/lib/actions/events'

interface EventFormModalProps {
    isOpen: boolean
    onClose: () => void
    eventToEdit?: EventItem | null
    defaultDate?: string
}

export function EventFormModal({ isOpen, onClose, eventToEdit, defaultDate }: EventFormModalProps) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [eventDate, setEventDate] = useState(defaultDate || new Date().toISOString().split('T')[0])
    const [startTime, setStartTime] = useState('09:00')
    const [endTime, setEndTime] = useState('10:00')
    const [eventType, setEventType] = useState<'meeting' | 'event' | 'appointment' | 'reminder' | 'birthday'>('event')
    const [location, setLocation] = useState('')
    const [colorHex, setColorHex] = useState('#6366f1')
    const [isAllDay, setIsAllDay] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (eventToEdit) {
            setTitle(eventToEdit.title)
            setDescription(eventToEdit.description || '')
            setEventDate(eventToEdit.event_date)
            setStartTime(eventToEdit.start_time || '09:00')
            setEndTime(eventToEdit.end_time || '10:00')
            setEventType(eventToEdit.event_type)
            setLocation(eventToEdit.location || '')
            setColorHex(eventToEdit.color_hex || '#6366f1')
            setIsAllDay(eventToEdit.is_all_day)
        } else {
            setTitle('')
            setDescription('')
            setEventDate(defaultDate || new Date().toISOString().split('T')[0])
            setStartTime('09:00')
            setEndTime('10:00')
            setEventType('event')
            setLocation('')
            setColorHex('#6366f1')
            setIsAllDay(false)
        }
    }, [eventToEdit, defaultDate, isOpen])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !eventDate) return

        setLoading(true)
        const formData = new FormData()
        formData.append('title', title)
        formData.append('description', description)
        formData.append('event_date', eventDate)
        formData.append('start_time', isAllDay ? '' : startTime)
        formData.append('end_time', isAllDay ? '' : endTime)
        formData.append('event_type', eventType)
        formData.append('location', location)
        formData.append('color_hex', colorHex)
        formData.append('is_all_day', isAllDay ? 'true' : 'false')

        let res
        if (eventToEdit) {
            res = await updateEvent(eventToEdit.id, formData)
        } else {
            res = await createEvent(formData)
        }

        setLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            onClose()
        }
    }

    async function handleDelete() {
        if (!eventToEdit) return
        if (!confirm('¿Eliminar este evento/reunión?')) return

        setLoading(true)
        const res = await deleteEvent(eventToEdit.id)
        setLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            onClose()
        }
    }

    const googleUrl = getGoogleCalendarUrl({
        title,
        description,
        event_date: eventDate,
        start_time: isAllDay ? null : startTime,
        end_time: isAllDay ? null : endTime,
        location
    })

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="glass border border-border/50 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                                <h3 className="font-heading font-bold text-lg text-white">
                                    {eventToEdit ? 'Editar Evento / Reunión' : 'Nuevo Evento / Reunión'}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Título *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Reunión de equipo / Consulta médica"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                        Tipo
                                    </label>
                                    <select
                                        value={eventType}
                                        onChange={(e: any) => setEventType(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="meeting">👥 Reunión</option>
                                        <option value="event">📅 Evento</option>
                                        <option value="appointment">🩺 Cita / Turno</option>
                                        <option value="reminder">🔔 Recordatorio</option>
                                        <option value="birthday">🎂 Cumpleaños</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                        Color
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setColorHex(color)}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                                    colorHex === color ? 'scale-110 border-white' : 'border-transparent'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                {!isAllDay && (
                                    <>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                                Inicio
                                            </label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                                Fin
                                            </label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="is_all_day"
                                    checked={isAllDay}
                                    onChange={(e) => setIsAllDay(e.target.checked)}
                                    className="rounded border-white/20 bg-black/20 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="is_all_day" className="text-xs font-medium text-white/80 cursor-pointer">
                                    Todo el día
                                </label>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Ubicación / Link de reunión
                                </label>
                                <div className="relative">
                                    <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="Google Meet, Zoom, Dirección..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Descripción / Notas
                                </label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detalles importantes..."
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            {title && (
                                <a
                                    href={googleUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Sincronizar / Enviar a Google Calendar
                                </a>
                            )}
                        </form>

                        <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/10">
                            {eventToEdit ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-all"
                                >
                                    Eliminar
                                </button>
                            ) : <div />}

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (eventToEdit ? 'Guardar Cambios' : 'Crear Evento')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
