'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DndContext, DragOverlay, pointerWithin, MouseSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { assignTaskToDay, unassignTaskFromDay, saveWeeklyPlan, type WeeklyPlanItem, getWeeklyPlan } from '@/lib/actions/weekly_plans'
import { setTaskBlocks } from '@/lib/actions/morning_ritual'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { type EventItem, getEventsByDateRange } from '@/lib/actions/events'
import { WeekGrid, BacklogList } from '@/components/planner/WeekGrid'
import { EventFormModal } from '@/components/calendar/EventFormModal'
import { TaskForm } from '@/components/tasks/TaskForm'
import { ModuleTabs } from '@/components/layout/ModuleTabs'
import { PageShell, PageHeader, Panel, SectionLabel, Check } from '@/components/ui/kit'
import { getLocalDateStr, addDaysToDateStr, cn } from '@/lib/utils'

const NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const day = (t: any) => String(t.planned_date || '').slice(0, 10)
const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

export function PlannerClient({ initialTasks, initialUnplanned, initialEvents, initialPlan, initialMondayStr }: {
    initialTasks: any[]; initialUnplanned: any[]; initialEvents: EventItem[]; initialPlan: WeeklyPlanItem | null; initialMondayStr: string
}) {
    const today = getLocalDateStr()
    const [offset, setOffset] = useState(0)
    const [tasks, setTasks] = useState<any[]>(initialTasks)
    const [unplanned, setUnplanned] = useState<any[]>(initialUnplanned)
    const [events, setEvents] = useState(initialEvents)
    const [plan, setPlan] = useState<WeeklyPlanItem | null>(initialPlan)
    const [goals, setGoals] = useState(initialPlan?.weekly_goals || '')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [mobileDay, setMobileDay] = useState(today)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [addFor, setAddFor] = useState<string | null>(null)
    const [eventToEdit, setEventToEdit] = useState<EventItem | null>(null)
    const monday = addDaysToDateStr(initialMondayStr, offset * 7)
    const days = NAMES.map((name, i) => ({ name, dateStr: addDaysToDateStr(monday, i) }))
    // Solo mouse: en el celular se asigna tocando, así el dedo puede scrollear.
    const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }))

    useEffect(() => { setTasks(initialTasks); setUnplanned(initialUnplanned) }, [initialTasks, initialUnplanned])
    useEffect(() => {
        if (offset === 0) { setEvents(initialEvents); return }
        let alive = true
        getEventsByDateRange(monday, addDaysToDateStr(monday, 6)).then(e => alive && setEvents(e || [])).catch(() => { })
        return () => { alive = false }
    }, [monday, initialEvents]) // eslint-disable-line react-hooks/exhaustive-deps

    async function changeWeek(to: number) {
        if (dirty && !(await saveGoals())) return
        setMobileDay(to === 0 ? today : addDaysToDateStr(initialMondayStr, to * 7))
        setOffset(to)
        // Cada semana tiene sus objetivos: antes quedaban en pantalla los de la anterior.
        const p = await getWeeklyPlan(addDaysToDateStr(initialMondayStr, to * 7)).catch(() => null)
        setPlan(p)
        setGoals(p?.weekly_goals || '')
        setDirty(false)
    }
    async function saveGoals() {
        setSaving(true)
        const res = await saveWeeklyPlan(monday, plan?.plan_data || {}, goals, plan?.reflection || '')
        setSaving(false)
        if (res.error) { alert(res.error); return false }
        setDirty(false)
        return true
    }
    const find = (id: string) => tasks.find(t => t.id === id) || unplanned.find(t => t.id === id)
    function place(id: string, patch: any) {
        const t = find(id)
        if (!t) return null
        setUnplanned(p => p.filter(x => x.id !== id))
        setTasks(p => [...p.filter(x => x.id !== id), { ...t, ...patch }])
        return t
    }
    async function assignDay(id: string, d: string) {
        const t = place(id, { planned_date: d, block_start: null })
        if (!t) return
        const res = await assignTaskToDay(id, d)
        if (res.error) return alert(res.error)
        if (t.block_start) await setTaskBlocks([{ id, start: null, minutes: t.estimated_minutes || null }])
    }
    async function assignHour(id: string, d: string, hour: number) {
        const start = `${String(hour).padStart(2, '0')}:00`
        const minutes = find(id)?.estimated_minutes || 60
        if (!place(id, { planned_date: d, block_start: start, estimated_minutes: minutes })) return
        const a = await assignTaskToDay(id, d)
        const b = a.error ? a : await setTaskBlocks([{ id, start, minutes }])
        if (b.error) alert(b.error)
    }
    async function unassign(id: string) {
        const t = find(id)
        if (!t) return
        setTasks(p => p.filter(x => x.id !== id))
        setUnplanned(p => [...p.filter(x => x.id !== id), { ...t, planned_date: null, block_start: null }])
        await unassignTaskFromDay(id)
        if (t.block_start) await setTaskBlocks([{ id, start: null, minutes: t.estimated_minutes || null }])
    }
    async function complete(id: string) {
        setTasks(p => p.filter(t => t.id !== id))
        setUnplanned(p => p.filter(t => t.id !== id))
        await updateTaskStatus(id, 'Done')
    }
    function onDragEnd({ active, over }: DragEndEvent) {
        setActiveId(null)
        if (!over) return
        const [kind, d, h] = String(over.id).split('|')
        if (kind === 'backlog') unassign(String(active.id))
        else if (kind === 'slot') assignHour(String(active.id), d, Number(h))
        else if (kind === 'day') assignDay(String(active.id), d)
    }

    const dayTasks = tasks.filter(t => day(t) === mobileDay && t.status !== 'Done').sort((a, b) => String(a.block_start || '99').localeCompare(String(b.block_start || '99')))
    const dayEvents = events.filter(e => e.event_date === mobileDay)
    const load = tasks.filter(t => days.some(d => d.dateStr === day(t)) && t.status !== 'Done').reduce((n, t) => n + (t.estimated_minutes || 30), 0)
    const label = offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : offset === -1 ? 'Semana pasada' : `${short(days[0].dateStr)} — ${short(days[6].dateStr)}`

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={e => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
            <PageShell className="max-w-[1500px]">
                <PageHeader label="Planificar" title="Agenda" subtitle="Tu tiempo protegido: eventos en azul, tareas bloqueadas en ámbar."
                    actions={<><ModuleTabs module="agenda" /><button onClick={() => setAddFor(mobileDay)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Tarea</button></>} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
                    <div className="lg:col-span-5 flex items-center gap-2">
                        <button onClick={() => changeWeek(offset - 1)} aria-label="Semana anterior" className="w-11 h-11 rounded-xl border border-hairline flex items-center justify-center text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="flex-1 lg:flex-none lg:min-w-[190px] text-center"><p className="text-sm font-medium">{label}</p><p className="font-mono text-[11px] text-muted-foreground">{short(days[0].dateStr)} — {short(days[6].dateStr)}</p></div>
                        <button onClick={() => changeWeek(offset + 1)} aria-label="Semana siguiente" className="w-11 h-11 rounded-xl border border-hairline flex items-center justify-center text-muted-foreground hover:text-foreground"><ChevronRight className="w-4 h-4" /></button>
                        {offset !== 0 && <button onClick={() => changeWeek(0)} className="btn-secondary text-xs">Hoy</button>}
                    </div>
                    <Panel className="lg:col-span-7 !py-3">
                        <div className="flex items-center justify-between min-h-[32px]"><label htmlFor="goals" className="label-caps">Objetivos de la semana</label>{dirty ? <button onClick={saveGoals} disabled={saving} className="text-xs text-amber-300 min-h-[32px]">{saving ? 'Guardando…' : 'Guardar'}</button> : <Link href="/cierre?tab=semana" className="text-xs text-muted-foreground hover:text-foreground">Revisión semanal</Link>}</div>
                        <textarea id="goals" rows={2} value={goals} onChange={e => { setGoals(e.target.value); setDirty(true) }} placeholder="Hasta tres resultados que hagan que la semana valga" className="w-full bg-transparent resize-none text-sm leading-relaxed focus:outline-none placeholder:text-ink-faint" />
                    </Panel>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-6">
                    <aside className="order-2 lg:order-1 min-w-0">
                        <SectionLabel right={unplanned.length}>Sin planificar</SectionLabel>
                        <p className="text-xs text-muted-foreground mb-2"><span className="hidden lg:inline">Arrastrá una tarea a un día o a una hora.</span><span className="lg:hidden">Tocá una tarea para elegirle el día.</span></p>
                        <BacklogList tasks={unplanned} days={days} onAssign={assignDay} onComplete={complete} />
                        <p className="font-mono text-[11px] text-muted-foreground mt-4 pt-4 border-t border-hairline">carga de la semana {Math.floor(load / 60)}h {load % 60}m</p>
                    </aside>
                    <div className="order-1 lg:order-2 min-w-0">
                        <WeekGrid days={days} today={today} tasks={tasks} events={events} onComplete={complete} onUnassign={unassign} onAdd={setAddFor} onEvent={setEventToEdit} />
                        <div className="lg:hidden space-y-4">
                            <div className="grid grid-cols-7 gap-1">{days.map(d => <button key={d.dateStr} onClick={() => setMobileDay(d.dateStr)} className={cn('h-14 rounded-xl border flex flex-col items-center justify-center text-[11px]', mobileDay === d.dateStr ? 'lamp text-amber-300' : 'border-hairline text-muted-foreground')}>{d.name.slice(0, 2)}<span className="font-mono text-sm">{d.dateStr.slice(8)}</span></button>)}</div>
                            <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                                {dayEvents.map(e => <button key={e.id} onClick={() => setEventToEdit(e)} className="w-full text-left flex items-center gap-3 px-4 min-h-[52px] text-sm"><span className="font-mono text-xs text-sky-300 w-12">{e.start_time?.slice(0, 5) || 'día'}</span>{e.title}</button>)}
                                {dayTasks.map(t => <div key={t.id} className="flex items-center gap-3 px-4 min-h-[52px] text-sm"><span className="font-mono text-xs text-amber-300 w-12">{t.block_start ? String(t.block_start).slice(0, 5) : '—'}</span><span className="flex-1">{t.title}</span><button onClick={() => complete(t.id)} aria-label="Marcar hecha" className="p-3 -mr-3"><Check done={false} /></button></div>)}
                                {!dayEvents.length && !dayTasks.length && <p className="px-4 py-6 text-sm text-muted-foreground">Día libre. Asigná algo de la lista de abajo.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </PageShell>
            {addFor && <div className="fixed inset-0 z-[90]"><div className="absolute inset-0 bg-[#000]/60" onClick={() => setAddFor(null)} /><div className="absolute right-0 inset-y-0 w-full sm:w-[480px] bg-card border-l border-hairline flex flex-col"><TaskForm onClose={() => setAddFor(null)} initialDate={addFor} /></div></div>}
            <EventFormModal isOpen={!!eventToEdit} onClose={() => setEventToEdit(null)} eventToEdit={eventToEdit} defaultDate={today} />
            <DragOverlay>{activeId && find(activeId) && <div className="rounded-lg bg-popover border border-amber-400/50 px-3 py-2 text-xs shadow-2xl max-w-[200px]">{find(activeId).title}</div>}</DragOverlay>
        </DndContext>
    )
}
