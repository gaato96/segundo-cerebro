'use client'

import { useEffect, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, X } from 'lucide-react'
import { Check } from '@/components/ui/kit'
import type { EventItem } from '@/lib/actions/events'
import { cn } from '@/lib/utils'

const FIRST_HOUR = 6
const LAST_HOUR = 24
const ROW = 48
const toMin = (t?: string | null) => {
    if (!t) return null
    const [h, m] = String(t).split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
const stop = (e: React.SyntheticEvent) => e.stopPropagation()

function DragTask({ task, children, className, style }: { task: any; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    const { listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
    return <div ref={setNodeRef} {...listeners} style={style} className={cn('cursor-grab active:cursor-grabbing select-none', isDragging && 'opacity-40', className)}>{children}</div>
}

function HourCell({ day, hour }: { day: string; hour: number }) {
    const { setNodeRef, isOver } = useDroppable({ id: `slot|${day}|${hour}` })
    return <div ref={setNodeRef} className={cn('border-b border-hairline', isOver && 'bg-amber-400/15')} style={{ height: ROW }} />
}

interface GridProps {
    days: { name: string; dateStr: string }[]; today: string; tasks: any[]; events: EventItem[]
    onComplete: (id: string) => void; onUnassign: (id: string) => void; onAdd: (d: string) => void; onEvent: (e: EventItem) => void
}

function DayHead({ day, name, isToday, tasks, allDay, onComplete, onUnassign, onAdd, onEvent }: Omit<GridProps, 'days' | 'today' | 'events'> & { day: string; name: string; isToday: boolean; allDay: EventItem[] }) {
    const { setNodeRef, isOver } = useDroppable({ id: `day|${day}` })
    return (
        <div ref={setNodeRef} className={cn('p-2 border-b border-l border-hairline min-h-[112px] min-w-0 space-y-1.5', isToday && 'bg-raised/40', isOver && 'bg-amber-400/15')}>
            <button onClick={() => onAdd(day)} title="Agregar tarea este día" className={cn('w-full text-left text-xs font-medium flex justify-between', isToday ? 'text-amber-300' : 'text-foreground')}>{name.slice(0, 3)} <span className="font-mono text-muted-foreground">{day.slice(8)}/{day.slice(5, 7)}</span></button>
            {allDay.map(e => <button key={e.id} onClick={() => onEvent(e)} className="w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-md bg-sky-400/10 text-sky-200 truncate">{e.title}</button>)}
            {tasks.map(t => (
                <DragTask key={t.id} task={t} className="rounded-md border border-hairline bg-raised px-1.5 py-1 text-[11px] leading-tight flex gap-1.5">
                    <button onPointerDown={stop} onClick={() => onComplete(t.id)} aria-label="Marcar hecha"><Check done={false} className="!w-3.5 !h-3.5 !rounded" /></button>
                    <span className="flex-1 min-w-0 line-clamp-2">{t.title}</span>
                    <button onPointerDown={stop} onClick={() => onUnassign(t.id)} aria-label="Sacar del día" className="text-ink-faint hover:text-foreground self-start"><X className="w-3 h-3" /></button>
                </DragTask>
            ))}
        </div>
    )
}

/** Semana con horas: eventos en azul, tareas en ámbar. Una tarea arrastrada a una hora queda bloqueada ahí. */
export function WeekGrid({ days, today, tasks, events, ...on }: GridProps) {
    const scroll = useRef<HTMLDivElement>(null)
    const [now, setNow] = useState<number | null>(null)
    useEffect(() => {
        const tick = () => {
            const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number)
            setNow(h * 60 + m)
            return h
        }
        scroll.current?.scrollTo({ top: Math.max(0, (tick() - FIRST_HOUR - 2) * ROW) })
        const id = setInterval(tick, 60000)
        return () => clearInterval(id)
    }, [])
    const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i)
    const cols = { gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))' }
    const of = (d: string) => tasks.filter(t => String(t.planned_date || '').slice(0, 10) === d && t.status !== 'Done')

    return (
        <div className="hidden lg:block rounded-2xl bg-card border border-hairline overflow-hidden">
            <div className="grid" style={cols}>
                <div className="border-b border-hairline" />
                {days.map(d => <DayHead key={d.dateStr} day={d.dateStr} name={d.name} isToday={d.dateStr === today} tasks={of(d.dateStr).filter(t => !t.block_start)} allDay={events.filter(e => e.event_date === d.dateStr && (e.is_all_day || !e.start_time))} {...on} />)}
            </div>
            <div ref={scroll} className="max-h-[58vh] overflow-y-auto">
                <div className="grid" style={cols}>
                    <div>{hours.map(h => <div key={h} className="font-mono text-[10px] text-ink-faint text-right pr-2 pt-1" style={{ height: ROW }}>{String(h).padStart(2, '0')}:00</div>)}</div>
                    {days.map(d => {
                        const items = [
                            ...events.filter(e => e.event_date === d.dateStr && !e.is_all_day && e.start_time).map(e => {
                                const s = toMin(e.start_time)!
                                return { key: e.id, start: s, end: Math.max(s + 20, toMin(e.end_time) ?? s + 60), event: e as EventItem | null, task: null as any }
                            }),
                            ...of(d.dateStr).filter(t => t.block_start).map(t => {
                                const s = toMin(t.block_start)!
                                return { key: t.id as string, start: s, end: s + (t.estimated_minutes || 60), event: null as EventItem | null, task: t }
                            })
                        ].sort((a, b) => a.start - b.start)
                        return (
                            <div key={d.dateStr} className={cn('relative border-l border-hairline', d.dateStr === today && 'bg-raised/25')}>
                                {hours.map(h => <HourCell key={h} day={d.dateStr} hour={h} />)}
                                {items.map((it, i) => {
                                    const clash = items.map((o, j) => ({ o, j })).filter(({ o, j }) => j !== i && o.start < it.end && o.end > it.start)
                                    const lanes = Math.min(3, clash.length + 1)
                                    const lane = Math.min(lanes - 1, clash.filter(c => c.j < i).length)
                                    const style = { top: Math.max(0, (it.start / 60 - FIRST_HOUR) * ROW) + 1, height: Math.max(22, ((it.end - it.start) / 60) * ROW - 2), left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }
                                    const label = `${String(Math.floor(it.start / 60)).padStart(2, '0')}:${String(it.start % 60).padStart(2, '0')}`
                                    return it.event ? (
                                        <button key={it.key} onClick={() => on.onEvent(it.event!)} style={style} className="absolute z-10 overflow-hidden text-left rounded-md bg-sky-400/15 border border-sky-400/30 px-1.5 py-1 text-[11px] leading-tight flex flex-col"><span className="font-mono text-[10px] text-sky-300">{label}</span>{it.event.title}</button>
                                    ) : (
                                        <DragTask key={it.key} task={it.task} style={style} className="absolute z-10 overflow-hidden rounded-md bg-amber-400/10 border border-amber-400/30 px-1.5 py-1 text-[11px] leading-tight">
                                            <span className="flex justify-between"><span className="font-mono text-[10px] text-amber-300">{label}</span><button onPointerDown={stop} onClick={() => on.onComplete(it.task.id)} aria-label="Marcar hecha"><Check done={false} className="!w-3.5 !h-3.5 !rounded" /></button></span>{it.task.title}
                                        </DragTask>
                                    )
                                })}
                                {d.dateStr === today && now !== null && now >= FIRST_HOUR * 60 && <span className="absolute left-0 right-0 h-px bg-amber-400 z-20 pointer-events-none" style={{ top: (now / 60 - FIRST_HOUR) * ROW }} />}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export function BacklogList({ tasks, days, onAssign, onComplete }: { tasks: any[]; days: { name: string; dateStr: string }[]; onAssign: (id: string, d: string) => void; onComplete: (id: string) => void }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })
    const [open, setOpen] = useState<string | null>(null)
    return (
        <div ref={setNodeRef} className={cn('divide-y divide-hairline max-h-[65vh] overflow-y-auto rounded-xl', isOver && 'bg-amber-400/10')}>
            {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4">Todo tiene día asignado.</p>}
            {tasks.map(t => (
                <div key={t.id}>
                    <DragTask task={t} className="flex items-start gap-2.5 py-2.5">
                        <GripVertical className="hidden lg:block w-4 h-4 text-ink-faint shrink-0 mt-0.5" />
                        <button onPointerDown={stop} onClick={() => onComplete(t.id)} aria-label="Marcar hecha"><Check done={false} /></button>
                        <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex-1 min-w-0 text-left text-sm leading-snug">{t.title}{t.estimated_minutes ? <span className="block font-mono text-[11px] text-muted-foreground">{t.estimated_minutes} min</span> : null}</button>
                    </DragTask>
                    {open === t.id && <div className="grid grid-cols-7 gap-1 pb-3">{days.map(d => <button key={d.dateStr} onClick={() => { onAssign(t.id, d.dateStr); setOpen(null) }} className="h-10 rounded-lg border border-hairline text-[11px] text-muted-foreground hover:text-foreground">{d.name.slice(0, 2)}</button>)}</div>}
                </div>
            ))}
        </div>
    )
}
