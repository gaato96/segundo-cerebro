'use client'

import { Calendar, Clock, MapPin, Users } from 'lucide-react'
import { EventItem } from '@/lib/actions/events'
import Link from 'next/link'

interface TodayEventsWidgetProps {
    events: EventItem[]
}

export function TodayEventsWidget({ events }: TodayEventsWidgetProps) {
    return (
        <div className="glass rounded-2xl p-6 border border-border/50 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0 text-indigo-400">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-heading font-semibold">Eventos & Reuniones Hoy</h2>
                </div>
                <Link href="/calendar" className="text-xs text-indigo-400 font-semibold hover:text-indigo-300">
                    Ver Calendario →
                </Link>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/5 rounded-xl text-xs text-muted-foreground italic">
                    Sin eventos agendados para el día de hoy.
                </div>
            ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-1 flex items-center justify-between"
                            style={{ borderLeftWidth: 4, borderLeftColor: ev.color_hex }}
                        >
                            <div>
                                <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                                {ev.location && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 text-indigo-400" /> {ev.location}
                                    </span>
                                )}
                            </div>

                            <span className="text-xs font-mono font-bold text-indigo-300 shrink-0">
                                {ev.is_all_day ? 'Todo el día' : ev.start_time?.slice(0, 5)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
