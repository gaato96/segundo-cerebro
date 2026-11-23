'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, Pause, RotateCcw, Check as CheckIcon, X, CornerDownLeft, Loader2, Plus } from 'lucide-react'
import { updateTaskStatus, toggleSubtask, createSubtask } from '@/lib/actions/tasks'
import { captureItem } from '@/lib/actions/capture'
import { Check } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

interface Props {
    task: any | null
    subtasks: { id: string; title: string; status: string }[]
    queue: { id: string; title: string; status: string }[]
    objective: string | null
}

const PRESETS = [25, 50, 90]

/**
 * Modo foco: la tarea #1 en pantalla completa con un temporizador.
 * Lo que se cruza (la distracción) se anota sin salir y cae al Inbox.
 * El temporizador sobrevive a recargar la página.
 */
export function FocusMode({ task, subtasks: initialSubs, queue, objective }: Props) {
    const router = useRouter()
    const key = task ? `sc-focus-${task.id}` : 'sc-focus'
    const defaultMin = task?.estimated_minutes && task.estimated_minutes <= 120 ? task.estimated_minutes : 50

    const [minutes, setMinutes] = useState<number>(defaultMin)
    const [endsAt, setEndsAt] = useState<number | null>(null)
    const [pausedLeft, setPausedLeft] = useState<number | null>(null)
    const [now, setNow] = useState(Date.now())
    const [subs, setSubs] = useState(initialSubs)
    const [newSub, setNewSub] = useState('')
    const [capture, setCapture] = useState('')
    const [captured, setCaptured] = useState(0)
    const [busy, setBusy] = useState(false)
    const chimeRef = useRef(false)

    // Restaurar el temporizador si se recargó la página.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(key)
            if (!raw) return
            const s = JSON.parse(raw)
            if (s.minutes) setMinutes(s.minutes)
            if (s.endsAt && s.endsAt > Date.now()) setEndsAt(s.endsAt)
            if (s.pausedLeft) setPausedLeft(s.pausedLeft)
        } catch { }
    }, [key])

    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify({ minutes, endsAt, pausedLeft })) } catch { }
    }, [key, minutes, endsAt, pausedLeft])

    useEffect(() => {
        if (!endsAt) return
        const id = setInterval(() => setNow(Date.now()), 500)
        return () => clearInterval(id)
    }, [endsAt])

    const total = minutes * 60_000
    const left = endsAt ? Math.max(0, endsAt - now) : pausedLeft ?? total
    const running = !!endsAt && left > 0
    const finished = !!endsAt && left === 0
    const progress = 1 - left / total

    useEffect(() => {
        if (finished && !chimeRef.current) {
            chimeRef.current = true
            try {
                const ctx = new AudioContext()
                const o = ctx.createOscillator()
                const g = ctx.createGain()
                o.frequency.value = 660
                g.gain.setValueAtTime(0.12, ctx.currentTime)
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4)
                o.connect(g).connect(ctx.destination)
                o.start()
                o.stop(ctx.currentTime + 1.4)
            } catch { }
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Bloque de foco terminado', { body: task?.title || '' })
            }
        }
    }, [finished, task?.title])

    useEffect(() => {
        document.title = running ? `${fmt(left)} · ${task?.title || 'Foco'}` : 'Modo foco · Segundo Cerebro'
    }, [running, left, task?.title])

    function start() {
        chimeRef.current = false
        setEndsAt(Date.now() + (pausedLeft ?? total))
        setPausedLeft(null)
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => { })
    }
    function pause() {
        if (!endsAt) return
        setPausedLeft(Math.max(0, endsAt - Date.now()))
        setEndsAt(null)
    }
    function reset() {
        setEndsAt(null)
        setPausedLeft(null)
        chimeRef.current = false
    }

    async function toggleSub(id: string, status: string) {
        setSubs(prev => prev.map(s => (s.id === id ? { ...s, status: status === 'Done' ? 'Todo' : 'Done' } : s)))
        await toggleSubtask(id, status)
    }

    async function addSub(e: React.FormEvent) {
        e.preventDefault()
        if (!task || !newSub.trim()) return
        const title = newSub.trim()
        setNewSub('')
        setSubs(prev => [...prev, { id: `tmp-${Date.now()}`, title, status: 'Todo' }])
        await createSubtask(task.id, title)
        router.refresh()
    }

    async function saveCapture(e: React.FormEvent) {
        e.preventDefault()
        if (!capture.trim()) return
        const text = capture
        setCapture('')
        const res = await captureItem({ text, kind: 'inbox', source: 'keyboard' })
        if (res.ok) setCaptured(c => c + 1)
        else setCapture(text)
    }

    async function finish() {
        if (!task) return
        setBusy(true)
        await updateTaskStatus(task.id, 'Done')
        try { localStorage.removeItem(key) } catch { }
        const next = queue.find(t => t.id !== task.id && t.status !== 'Done')
        if (next) router.push(`/foco?task=${next.id}`)
        else router.push('/')
    }

    if (!task) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="label-caps">Modo foco</p>
                <h1 className="text-2xl font-semibold">No hay tareas de foco pendientes</h1>
                <p className="text-sm text-muted-foreground max-w-sm">Elegí el foco del día y volvé: acá aparece la primera tarea que te falta.</p>
                <div className="flex gap-2 mt-2">
                    <Link href="/ritual" className="btn-primary text-sm">Planificar el día</Link>
                    <Link href="/" className="btn-secondary text-sm">Volver a Hoy</Link>
                </div>
            </div>
        )
    }

    const position = queue.findIndex(t => t.id === task.id)
    const R = 108
    const C = 2 * Math.PI * R

    return (
        <div className="min-h-[100dvh] flex flex-col">
            <header className="flex items-center justify-between px-5 md:px-10 h-16">
                <Link href="/" className="h-10 px-3 -ml-3 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <X className="w-4 h-4" /> Salir
                </Link>
                {queue.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        {queue.map(t => (
                            <Link
                                key={t.id}
                                href={`/foco?task=${t.id}`}
                                title={t.title}
                                className={cn('h-1.5 rounded-full transition-all', t.id === task.id ? 'w-6 bg-amber-400' : t.status === 'Done' ? 'w-3 bg-emerald-400' : 'w-3 bg-raised')}
                            />
                        ))}
                    </div>
                )}
            </header>

            <main className="flex-1 w-full max-w-[1100px] mx-auto px-5 md:px-10 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                <section className="lg:col-span-7 space-y-8 order-2 lg:order-1">
                    <div>
                        <p className="label-caps">
                            {position >= 0 ? `Foco ${position + 1} de ${queue.length}` : 'Foco'}
                        </p>
                        <h1 className="text-3xl md:text-[40px] font-semibold tracking-tight leading-[1.1] mt-2">{task.title}</h1>
                        {objective && <p className="text-muted-foreground mt-3">→ {objective}</p>}
                        {task.description && <p className="text-sm text-muted-foreground mt-3 max-w-[60ch] whitespace-pre-wrap">{task.description}</p>}
                    </div>

                    <div>
                        <p className="label-caps mb-2">Pasos</p>
                        <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">
                            {subs.map(s => (
                                <button key={s.id} onClick={() => !s.id.startsWith('tmp') && toggleSub(s.id, s.status)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-left hover:bg-raised/50">
                                    <Check done={s.status === 'Done'} />
                                    <span className={cn('text-sm', s.status === 'Done' && 'line-through text-muted-foreground')}>{s.title}</span>
                                </button>
                            ))}
                            <form onSubmit={addSub} className="flex items-center gap-3 px-4 min-h-[48px]">
                                <Plus className="w-4 h-4 text-ink-faint shrink-0" />
                                <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="Agregar un paso" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-ink-faint" />
                            </form>
                        </div>
                    </div>

                    <form onSubmit={saveCapture}>
                        <p className="label-caps mb-2">¿Se te cruzó algo? Anotalo y seguí</p>
                        <div className="relative">
                            <input value={capture} onChange={e => setCapture(e.target.value)} placeholder="Va al Inbox, lo ves después" className="field pr-12" />
                            <button type="submit" aria-label="Anotar" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground">
                                <CornerDownLeft className="w-4 h-4" />
                            </button>
                        </div>
                        {captured > 0 && <p className="text-xs text-muted-foreground mt-1.5">{captured} {captured === 1 ? 'cosa anotada' : 'cosas anotadas'} en el Inbox.</p>}
                    </form>
                </section>

                <section className="lg:col-span-5 flex flex-col items-center gap-6 order-1 lg:order-2">
                    <div className="relative w-[240px] h-[240px] md:w-[260px] md:h-[260px]">
                        <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90">
                            <circle cx="120" cy="120" r={R} fill="none" stroke="hsl(var(--raised))" strokeWidth="6" />
                            <circle
                                cx="120" cy="120" r={R} fill="none"
                                stroke={finished ? 'hsl(var(--sage-400))' : 'hsl(var(--lamp-400))'}
                                strokeWidth="6" strokeLinecap="round"
                                strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                                className={cn('transition-[stroke-dashoffset] duration-500', running && 'animate-breathe')}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="font-mono text-5xl md:text-[56px] font-medium tracking-tight">{fmt(left)}</span>
                            <span className="text-xs text-muted-foreground mt-1">{finished ? 'Bloque terminado' : running ? 'En foco' : pausedLeft !== null ? 'En pausa' : `${minutes} minutos`}</span>
                        </div>
                    </div>

                    {!running && pausedLeft === null && !finished && (
                        <div className="flex gap-1.5">
                            {PRESETS.map(m => (
                                <button key={m} onClick={() => setMinutes(m)} className={cn('h-9 px-3 rounded-lg border font-mono text-xs', minutes === m ? 'border-amber-400/50 text-amber-300 bg-amber-400/10' : 'border-hairline text-muted-foreground hover:text-foreground')}>
                                    {m} min
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {running ? (
                            <button onClick={pause} className="btn-secondary text-sm"><Pause className="w-4 h-4" /> Pausa</button>
                        ) : (
                            <button onClick={start} className={cn(finished ? 'btn-secondary' : 'btn-primary', 'text-sm')}>
                                <Play className="w-4 h-4" /> {finished ? 'Otro bloque' : pausedLeft !== null ? 'Seguir' : 'Empezar'}
                            </button>
                        )}
                        {(running || pausedLeft !== null || finished) && (
                            <button onClick={reset} aria-label="Reiniciar" className="w-11 h-11 rounded-xl border border-hairline flex items-center justify-center text-muted-foreground hover:text-foreground">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <button onClick={finish} disabled={busy} className={cn(finished ? 'btn-primary' : 'btn-secondary', 'text-sm')}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                        Terminé esta tarea
                    </button>
                </section>
            </main>
        </div>
    )
}

function fmt(ms: number) {
    const s = Math.ceil(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
