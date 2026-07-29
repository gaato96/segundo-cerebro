'use client'

import { motion } from 'framer-motion'
import { Clock, MapPin, ExternalLink, MoreVertical, Users, Calendar, AlertCircle, Bell, Cake } from 'lucide-react'
import { EventItem, getGoogleCalendarUrl } from '@/lib/actions/events'

interface EventCardProps {
    event: EventItem
    onEdit?: (event: EventItem) => void
    compact?: boolean
}

export function EventCard({ event, onEdit, compact = false }: EventCardProps) {
    const getTypeIcon = () => {
        switch (event.event_type) {
            case 'meeting': return Users
            case 'appointment': return AlertCircle
            case 'reminder': return Bell
            case 'birthday': return Cake
            default: return Calendar
        }
    }

    const Icon = getTypeIcon()
    const googleUrl = getGoogleCalendarUrl(event)

    if (compact) {
        return (
            <motion.div
                whileHover={{ scale: 1.02 }}
                onClick={() => onEdit?.(event)}
                className="group flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/70 cursor-pointer transition-all"
                style={{ borderLeftWidth: 4, borderLeftColor: event.color_hex }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-semibold text-white/90 truncate">{event.title}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                    {event.is_all_day ? 'Día entero' : event.start_time?.slice(0, 5)}
                </span>
            </motion.div>
        )
    }

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="glass rounded-2xl p-4 border border-border/50 shadow-md relative overflow-hidden group transition-all"
            style={{ borderLeftWidth: 4, borderLeftColor: event.color_hex }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div
                        className="p-2 rounded-xl shrink-0"
                        style={{ backgroundColor: `${event.color_hex}20`, color: event.color_hex }}
                    >
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="font-heading font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {event.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 font-mono">
                            <Clock className="w-3 h-3 text-indigo-400" />
                            <span>
                                {event.is_all_day ? 'Todo el día' : `${event.start_time?.slice(0, 5)} ${event.end_time ? `- ${event.end_time.slice(0, 5)}` : ''}`}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <a
                        href={googleUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir en Google Calendar"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                        onClick={() => onEdit?.(event)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {event.description && (
                <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
                    {event.description}
                </p>
            )}

            {event.location && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-300/80 mt-2 font-medium">
                    <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">{event.location}</span>
                </div>
            )}
        </motion.div>
    )
}
