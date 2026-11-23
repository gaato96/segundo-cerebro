'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Focus, ArrowRight, Plus, Inbox, Moon, CalendarCheck2, Target, BookOpen } from 'lucide-react'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { toggleHabitToday, type TodayData, type CycleStep } from '@/lib/actions/today'
import { Check, Panel, SectionLabel } from '@/components/ui/kit'
import { cn, formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CYCLE: { id: CycleStep; label: string }[] = [
    { id: 'capturar', label: 'Capturar' },
    { id: 'planificar', label: 'Planificar' },
    { id: 'hacer', label: 'Hacer' },
    { id: 'cerrar', label: 'Cerrar' }
]

function greeting(hour: number) {
    if (hour < 6) return 'Todavía es de noche'
    if (hour < 13) return 'Buen día'
    if (hour < 20) return 'Buenas tardes'
    return 'Buenas noches'
}

function nowMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    const [h, m] = parts.split(':').map(Number)
    return h * 60 + m
}

const toMin = (t?: string | null) => {
    if (!t) return null
    const [h, m] = String(t).split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function TodayView({ data }: { data: TodayData }) {
    const router = useRouter()
    const [focus, setFocus] = useState(data.focusTasks)
    const [others, setOthers] = useState(data.otherTasks)
    const [habits, setHabits] = useState(data.habits)
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => { setFocus(data.focusTasks); setOthers(data.otherTasks); setHabits(data.habits) }, [data])
    useEffect(() => {
        setNow(nowMinutes())
        const id = setInterval(() => setNow(nowMinutes()), 60_000)
        return () => clearInterval(id)
    }, [])

    const hour = now !== null ? Math.floor(now / 60) : 9
    const done = focus.filter(t => t.status === 'Done').length
    const nextFocus = focus.find(t => t.status !== 'Done')

    async function toggleFocus(id: string) {
        const t = focus.find(x => x.id === id)
        if (!t) return
        const next = t.status === 'Done' ? 'Todo' : 'Done'
        setFocus(prev => prev.map(x => (x.id === id ? { ...x, status: next } : x)))
        await updateTaskStatus(id, next)
        if (next === 'Done' && focus.filter(x => x.id !== id).every(x => x.status === 'Done')) {
            import('canvas-confetti').then(c => c.default({ particleCount: 60, spread: 60, colors: ['#E0A54B', '#6FAE8C', '#EDEDEF'], origin: { y: 0.4 } }))
        }
    }

    async function completeOther(id: string) {
        setOthers(prev => prev.map(x => (x.id === id ? { ...x, status: 'Done' } : x)))
        await updateTaskStatus(id, 'Done')
        setTimeout(() => setOthers(prev => prev.filter(x => x.id !== id)), 600)
    }

    async function toggleHabit(id: string) {
        const h = habits.find(x => x.id === id)
        if (!h) return
        const value = !h.done_today
        setHabits(prev => prev.map(x => (x.id === id ? { ...x, done_today: value, week: [...x.week.slice(0, 6), value] } : x)))
        const res = await toggleHabitToday(id, value)
        if (res.error) setHabits(prev => prev.map(x => (x.id === id ? { ...x, done_today: !value } : x)))
    }

    // Línea del día: eventos con hora + tareas con bloque.
    const blocks = useMemo(() => {
        const items: { id: string; start: number; end: number; title: string; sub?: string; kind: 'event' | 'task' }[] = []
        for (const e of data.events) {
            const s = toMin(e.start_time)
            if (s === null || e.is_all_day) continue
            const end = toMin(e.end_time) ?? s + 60
            items.push({ id: e.id, start: s, end, title: e.title, sub: e.location || undefined, kind: 'event' })
        }
        for (const t of focus) {
            const s = toMin(t.block_start)
            if (s === null) continue
            items.push({ id: t.id, start: s, end: s + (t.estimated_minutes || 60), title: t.title, sub: 'Bloque de foco', kind: 'task' })
        }
        return items.sort((a, b) => a.start - b.start)
    }, [data.events, focus])
    const allDay = data.events.filter((e: any) => e.is_all_day || !e.start_time)

    const habitsDone = habits.filter(h => h.done_today).length
    const currentIdx = CYCLE.findIndex(c => c.id === data.cycle)

    return (
        <div className="space-y-8">
            {/* Cabecera */}
            <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between pb-6 border-b border-hairline">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                        {format(new Date(`${data.today}T12:00:00`), "EEEE d/MM", { locale: es })}
                        {data.appDay.isAfterMidnight && ' · el día todavía no cerró'}
                    </p>
                    <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight leading-tight">{greeting(hour)}</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        {data.planned
                            ? `Tenés ${focus.length} ${focus.length === 1 ? 'tarea' : 'tareas'} de foco, ${data.events.length} ${data.events.length === 1 ? 'evento' : 'eventos'} y ${habits.length} hábitos.`
                            : data.inbox.count > 0
                                ? `Tenés ${data.inbox.count} capturas en el Inbox. Vacialo y elegí el foco.`
                                : 'Elegí el foco del día y arrancá.'}
                    </p>
                </div>

                {/* Indicador del ciclo */}
                <nav aria-label="Ciclo del día" className="flex items-center gap-1 p-1 rounded-xl bg-card border border-hairline self-start lg:self-auto">
                    {CYCLE.map((c, i) => {
                        const isCurrent = c.id === data.cycle
                        const isPast = data.cycle === 'cerrado' || i < currentIdx
                        const href = c.id === 'capturar' ? '/inbox' : c.id === 'planificar' ? '/ritual' : c.id === 'cerrar' ? '/cierre' : '#foco'
                        return (
                            <Link
                                key={c.id}
                                href={href}
                                className={cn(
                                    'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors',
                                    isCurrent ? 'bg-raised text-amber-300' : isPast ? 'text-muted-foreground' : 'text-ink-faint hover:text-foreground'
                                )}
                            >
                                {isPast && !isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> : isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-breathe" /> : null}
                                {c.label}
                                {c.id === 'capturar' && data.inbox.count > 0 && <span className="font-mono text-[10px] text-muted-foreground">{data.inbox.count}</span>}
                            </Link>
                        )
                    })}
                </nav>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Ahora */}
                <div className="lg:col-span-8 space-y-8 min-w-0">
                    {data.planned ? (
                        <section id="foco" className="lamp rounded-2xl p-5 md:p-6 relative overflow-hidden">
                            <span className="absolute left-0 top-6 bottom-6 w-[2px] rounded-full bg-amber-400 animate-breathe" />
                            <div className="flex items-start justify-between gap-3">
                                <p className="label-caps !text-amber-300/90">Foco de hoy</p>
                                <span className="font-mono text-xs text-amber-200/80">{done} de {focus.length}</span>
                            </div>
                            <h2 className="text-lg md:text-xl font-semibold mt-1.5 leading-snug">{data.focus || focus[0]?.title}</h2>

                            <div className="mt-4 rounded-xl border border-amber-400/15 divide-y divide-amber-400/10 bg-background/30">
                                {focus.map((t, i) => (
                                    <button
                                        key={t.id}
                                        onClick={() => toggleFocus(t.id)}
                                        className="w-full flex items-center gap-3 px-3.5 min-h-[52px] py-2.5 text-left hover:bg-amber-400/5 transition-colors"
                                    >
                                        <span className={cn('font-mono text-xs w-4 shrink-0', i === 0 ? 'text-amber-300' : 'text-muted-foreground')}>{i + 1}</span>
                                        <Check done={t.status === 'Done'} accent={i === 0} />
                                        <span className="flex-1 min-w-0">
                                            <span className={cn('block text-sm leading-snug', t.status === 'Done' && 'line-through text-muted-foreground')}>{t.title}</span>
                                            {t.objective_title && <span className="block text-xs text-muted-foreground truncate">→ {t.objective_title}</span>}
                                        </span>
                                        {t.block_start && <span className="font-mono text-[11px] text-muted-foreground shrink-0">{String(t.block_start).slice(0, 5)}</span>}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="h-1 flex-1 max-w-[200px] rounded-full bg-background/40 overflow-hidden">
                                    <div className="h-full bg-amber-400 transition-[width] duration-500" style={{ width: `${focus.length ? (done / focus.length) * 100 : 0}%` }} />
                                </div>
                                {nextFocus ? (
                                    <Link href={`/foco?task=${nextFocus.id}`} className="btn-secondary !min-h-9 h-9 text-xs">
                                        <Focus className="w-4 h-4" /> Modo foco
                                    </Link>
                                ) : (
                                    <span className="text-xs text-emerald-300">Foco cumplido</span>
                                )}
                            </div>
                        </section>
                    ) : (
                        <section className="lamp rounded-2xl p-6 md:p-7">
                            <p className="label-caps !text-amber-300/90">Antes de arrancar</p>
                            <h2 className="text-xl font-semibold mt-1.5">Todavía no elegiste el foco de hoy</h2>
                            <p className="text-sm text-muted-foreground mt-1.5 max-w-[55ch]">
                                {data.inbox.count > 0
                                    ? `Primero vaciá las ${data.inbox.count} capturas del Inbox, después elegí hasta 3 tareas. Son 3 minutos.`
                                    : 'Elegí hasta 3 tareas mirando tus objetivos y hábitos. Son 2 minutos.'}
                            </p>
                            <Link href="/ritual" className="btn-primary mt-5 text-sm">
                                <CalendarCheck2 className="w-4 h-4" /> Planificar el día <ArrowRight className="w-4 h-4" />
                            </Link>
                        </section>
                    )}

                    {/* Línea del día */}
                    <section>
                        <SectionLabel right={blocks.length ? `${hhmm(blocks[0].start)} — ${hhmm(blocks[blocks.length - 1].end)}` : undefined}>Línea del día</SectionLabel>
                        {blocks.length === 0 && allDay.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-hairline px-5 py-6 text-sm text-muted-foreground">
                                Sin eventos ni bloques con hora. En <Link href="/ritual" className="text-foreground underline underline-offset-4 decoration-hairline">Planificar el día</Link> podés ponerle hora a cada tarea del foco.
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                                {allDay.map((e: any) => (
                                    <div key={e.id} className="flex items-center gap-4 px-4 min-h-[48px] py-2">
                                        <span className="font-mono text-[11px] text-muted-foreground w-[88px] shrink-0">todo el día</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                                        <span className="text-sm truncate">{e.title}</span>
                                    </div>
                                ))}
                                {blocks.map(b => {
                                    const isNow = now !== null && now >= b.start && now < b.end
                                    const isPast = now !== null && now >= b.end
                                    return (
                                        <div key={`${b.kind}-${b.id}`} className={cn('relative flex items-center gap-4 px-4 min-h-[56px] py-2.5', isPast && 'opacity-55')}>
                                            {isNow && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-amber-400" />}
                                            <span className={cn('font-mono text-[11px] w-[88px] shrink-0', isNow ? 'text-amber-300' : 'text-muted-foreground')}>
                                                {hhmm(b.start)} — {hhmm(b.end)}
                                            </span>
                                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', b.kind === 'event' ? 'bg-sky-400' : 'bg-amber-400')} />
                                            <span className="min-w-0">
                                                <span className="block text-sm truncate">{b.title}</span>
                                                {b.sub && <span className="block text-xs text-muted-foreground truncate">{b.sub}</span>}
                                            </span>
                                            {isNow && <span className="ml-auto font-mono text-[10px] text-amber-300 shrink-0">ahora</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {/* También para hoy */}
                    <section>
                        <SectionLabel right={
                            <button onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-capture', { detail: { kind: 'task' } }))} className="flex items-center gap-1 hover:text-foreground">
                                <Plus className="w-3.5 h-3.5" /> Tarea
                            </button>
                        }>
                            También para hoy · {others.length}
                        </SectionLabel>
                        {others.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nada más para hoy. Lo que entre, entra por el Inbox.</p>
                        ) : (
                            <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                                <AnimatePresence initial={false}>
                                    {others.slice(0, 8).map(t => {
                                        const due = t.due_date ? String(t.due_date).slice(0, 10) : null
                                        const overdue = due && due < data.today
                                        return (
                                            <motion.button
                                                layout
                                                key={t.id}
                                                exit={{ opacity: 0, height: 0 }}
                                                onClick={() => completeOther(t.id)}
                                                className="w-full flex items-center gap-3 px-4 min-h-[52px] py-2.5 text-left hover:bg-raised/50 transition-colors"
                                            >
                                                <Check done={t.status === 'Done'} />
                                                <span className="flex-1 min-w-0">
                                                    <span className={cn('block text-sm truncate', t.status === 'Done' && 'line-through text-muted-foreground')}>{t.title}</span>
                                                    {t.objective_title && <span className="block text-xs text-muted-foreground truncate">→ {t.objective_title}</span>}
                                                </span>
                                                {due && (
                                                    <span className={cn('font-mono text-[11px] shrink-0 flex items-center gap-1.5', overdue ? 'text-red-300' : 'text-muted-foreground')}>
                                                        {overdue && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                                                        {overdue ? 'vencida ' : ''}{due.slice(8, 10)}/{due.slice(5, 7)}
                                                    </span>
                                                )}
                                            </motion.button>
                                        )
                                    })}
                                </AnimatePresence>
                                {others.length > 8 && (
                                    <Link href="/tasks" className="flex items-center justify-center h-11 text-xs text-muted-foreground hover:text-foreground">
                                        Ver las {others.length} en Tareas
                                    </Link>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Contexto */}
                <aside className="lg:col-span-4 space-y-4 min-w-0">
                    <Panel>
                        <SectionLabel right={`${habitsDone}/${habits.length}`}>Hábitos</SectionLabel>
                        {habits.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin hábitos para hoy.</p>
                        ) : (
                            <div className="-mx-2">
                                {habits.map(h => (
                                    <button key={h.id} onClick={() => toggleHabit(h.id)} className="w-full flex items-center gap-3 px-2 min-h-[44px] rounded-lg hover:bg-raised/60 text-left">
                                        <Check done={h.done_today} />
                                        <span className={cn('flex-1 text-sm truncate', h.done_today && 'line-through text-muted-foreground')}>{h.title}</span>
                                        <span className="flex gap-[3px] shrink-0" aria-label="Últimos 7 días">
                                            {h.week.map((d, i) => (
                                                <span key={i} className={cn('w-1.5 h-1.5 rounded-full', d ? 'bg-emerald-400' : 'bg-raised', i === 6 && !d && 'ring-1 ring-[hsl(var(--hairline-strong))]')} />
                                            ))}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel>
                        <SectionLabel right={data.inbox.count ? `${data.inbox.count} sin procesar` : 'vacío'}>Inbox</SectionLabel>
                        {data.inbox.latest.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nada esperando. Lo que se te cruce: tecla C.</p>
                        ) : (
                            <div className="space-y-2">
                                {data.inbox.latest.map((n: any) => (
                                    <div key={n.id} className="flex items-baseline gap-2 text-sm">
                                        <span className="truncate flex-1">{n.content}</span>
                                        <span className="font-mono text-[10px] text-ink-faint shrink-0">{format(new Date(n.created_at), 'HH:mm')}</span>
                                    </div>
                                ))}
                                <Link href="/inbox" className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground pt-1">
                                    <Inbox className="w-3.5 h-3.5" /> Vaciar ahora <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}
                    </Panel>

                    <Panel>
                        <SectionLabel>Plata hoy</SectionLabel>
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-sm">
                                    Gastaste <span className="font-mono font-semibold">{formatCurrency(data.money.todaySpend ?? 0)}</span> hoy
                                </p>
                                {data.money.hasData && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Balance del mes <span className={cn('font-mono', data.money.balance < 0 ? 'text-red-300' : 'text-emerald-300')}>{formatCurrency(data.money.balance)}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-expense', { detail: { kind: 'expense' } }))}
                                className="btn-secondary !min-h-9 h-9 text-xs"
                            >
                                <Plus className="w-3.5 h-3.5" /> Gasto
                            </button>
                        </div>
                    </Panel>

                    {data.book && (
                        <Link href={`/leer/${data.book.id}`} className="block">
                            <Panel className="hover:border-[hsl(var(--hairline-strong))] transition-colors">
                                <SectionLabel right={`${Math.round((data.book.current_page / data.book.page_count) * 100)}%`}>Leyendo</SectionLabel>
                                <div className="flex gap-3">
                                    {data.book.cover ? (
                                        <img src={data.book.cover} alt="" className="w-12 aspect-[2/3] rounded-md object-cover border border-hairline" />
                                    ) : (
                                        <div className="w-12 aspect-[2/3] rounded-md bg-raised flex items-center justify-center"><BookOpen className="w-4 h-4 text-muted-foreground" /></div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-snug line-clamp-2">{data.book.title}</p>
                                        <p className="font-mono text-[11px] text-muted-foreground mt-1">pág {data.book.current_page} de {data.book.page_count}</p>
                                        <div className="h-1 mt-2 rounded-full bg-raised overflow-hidden">
                                            <div className="h-full bg-graphite-300" style={{ width: `${(data.book.current_page / data.book.page_count) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                        </Link>
                    )}

                    {(data.cycle === 'cerrar' || data.cycle === 'hacer') && (
                        <Link href="/cierre" className="flex items-center justify-between gap-3 h-12 px-4 rounded-2xl border border-hairline text-sm text-muted-foreground hover:text-foreground">
                            <span className="flex items-center gap-2"><Moon className="w-4 h-4" /> Cerrar el día</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}
                    {data.cycle === 'cerrado' && (
                        <p className="flex items-center gap-2 text-xs text-emerald-300 px-1"><Target className="w-3.5 h-3.5" /> Día cerrado. Mañana arrancás con el plan.</p>
                    )}
                </aside>
            </div>
        </div>
    )
}

