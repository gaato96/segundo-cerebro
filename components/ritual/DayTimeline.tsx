'use client'

import { Clock, MapPin, Users, Calendar } from 'lucide-react'
import { EventItem } from '@/lib/actions/events'

interface DayTimelineProps {
    events: EventItem[]
}

export function DayTimeline({ events }: DayTimelineProps) {
    if (events.length === 0) {
        return (
            <div className="glass p-6 text-center rounded-2xl border border-border/50 text-xs text-muted-foreground italic">
                No tenés reuniones ni eventos agendados para hoy.
            </div>
        )
    }

    return (
        <div className="relative border-l-2 border-indigo-500/20 ml-3 pl-6 space-y-4 py-2">
            {events.map((ev) => (
                <div key={ev.id} className="relative">
                    {/* Circle Bullet */}
                    <div
                        className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-indigo-500/20"
                        style={{ backgroundColor: ev.color_hex }}
                    />

                    <div className="glass p-3 rounded-xl border border-border/40 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white font-heading">
                                {ev.title}
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300 font-semibold">
                                {ev.is_all_day ? 'Todo el día' : `${ev.start_time?.slice(0, 5)} - ${ev.end_time?.slice(0, 5) || ''}`}
                            </span>
                        </div>
                        {ev.location && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-indigo-400" />
                                {ev.location}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
