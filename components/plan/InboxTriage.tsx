'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sun, CheckSquare, Calendar, Lightbulb, Archive, Loader2, Plus, Sparkles, Check, List, Layers
} from 'lucide-react'
import { applyInboxSuggestion, type NoteDestination } from '@/lib/actions/inbox_ai'
import { createMentalNote } from '@/lib/actions/mental_notes'
import { InboxAIProcessor } from '@/components/inbox/InboxAIProcessor'
import { addDaysToDateStr, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Note {
    id: string
    content: string
    created_at: string
}

interface Props {
    notes: Note[]
    dateStr: string
    /** Se llama cuando se movió algo, para refrescar las tareas del paso siguiente. */
    onChanged?: () => void
}

type Action = 'done' | 'today' | 'task' | 'event' | 'idea' | 'note'

const ACTIONS: { id: Action; label: string; key: string; icon: any; cls: string }[] = [
    { id: 'done', label: 'Hecho', key: 'D', icon: Check, cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 active:bg-emerald-500 active:text-black md:hover:bg-emerald-500 md:hover:text-black' },
    { id: 'today', label: 'Hoy', key: 'H', icon: Sun, cls: 'text-amber-300 border-amber-500/35 bg-amber-500/10 active:bg-amber-500 active:text-black md:hover:bg-amber-500 md:hover:text-black' },
    { id: 'task', label: 'Tarea', key: 'T', icon: CheckSquare, cls: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10 active:bg-indigo-500 active:text-white md:hover:bg-indigo-500 md:hover:text-white' },
    { id: 'event', label: 'Evento', key: 'E', icon: Calendar, cls: 'text-sky-300 border-sky-500/30 bg-sky-500/10 active:bg-sky-500 active:text-white md:hover:bg-sky-500 md:hover:text-white' },
    { id: 'idea', label: 'Idea', key: 'I', icon: Lightbulb, cls: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10 active:bg-yellow-500 active:text-black md:hover:bg-yellow-500 md:hover:text-black' },
    { id: 'note', label: 'Archivar', key: 'A', icon: Archive, cls: 'text-muted-foreground border-border bg-secondary/50 active:text-foreground md:hover:text-foreground' }
]

/** Textarea que crece con el texto: la captura siempre se lee entera. */
function AutoText({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
    const ref = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [value])
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            className={cn('w-full bg-transparent resize-none overflow-hidden focus:outline-none focus:bg-black/20 rounded-lg', className)}
        />
    )
}

/**
 * Paso 1 del plan del día: vaciar el Inbox ("triage" = clasificar rápido).
 *
 * Modo rápido: una captura por vez, botones grandes, un toque y pasa a la
 * siguiente sin esperar al servidor (se guarda por detrás). En la compu
 * también con teclado: D H T E I A.
 */
export function InboxTriage({ notes: initialNotes, dateStr, onChanged }: Props) {
    const [notes, setNotes] = useState(initialNotes)
    const [handled, setHandled] = useState<Set<string>>(new Set())
    const [titles, setTitles] = useState<Record<string, string>>({})
    const [mode, setMode] = useState<'quick' | 'list' | 'ai'>('quick')
    const [eventFor, setEventFor] = useState<string | null>(null)
    const [eventDate, setEventDate] = useState(dateStr)
    const [eventTime, setEventTime] = useState('')
    const [capture, setCapture] = useState('')
    const [capturing, setCapturing] = useState(false)
    const [pendingSaves, setPendingSaves] = useState(0)
    const [error, setError] = useState('')
    const [doneCount, setDoneCount] = useState(0)

    // Si el servidor trae capturas nuevas (o la IA procesó algunas), se sincroniza
    // sin resucitar las que ya se movieron acá.
    useEffect(() => {
        setNotes(prev => {
            const serverIds = new Set(initialNotes.map(n => n.id))
            const localOnly = prev.filter(n => !serverIds.has(n.id) && !handled.has(n.id) && mode !== 'ai')
            return [...initialNotes.filter(n => !handled.has(n.id)), ...localOnly]
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNotes])

    const titleOf = (n: Note) => titles[n.id] ?? n.content.replace(/\s+/g, ' ').trim()
    const current = notes[0]

    function send(note: Note, action: Action) {
        if (action === 'event' && eventFor !== note.id) {
            setEventFor(note.id)
            setEventDate(dateStr)
            setEventTime('')
            return
        }

        const destination: NoteDestination = action === 'today' ? 'task' : action
        const payload = {
            note_id: note.id,
            destination,
            title: (titleOf(note) || note.content).slice(0, 200),
            description: note.content,
            planned_date: action === 'today' ? dateStr : null,
            event_date: action === 'event' ? eventDate : null,
            start_time: action === 'event' ? eventTime || null : null,
            reason: ''
        }

        // Optimista: sale de la lista ya; si falla, vuelve al principio.
        setNotes(prev => prev.filter(n => n.id !== note.id))
        setHandled(prev => new Set(prev).add(note.id))
        setDoneCount(c => c + 1)
        setEventFor(null)
        setError('')
        setPendingSaves(c => c + 1)

        applyInboxSuggestion(payload)
            .then(() => onChanged?.())
            .catch((e: any) => {
                setNotes(prev => [note, ...prev])
                setHandled(prev => {
                    const next = new Set(prev)
                    next.delete(note.id)
                    return next
                })
                setDoneCount(c => c - 1)
                setError(`No se pudo mover "${note.content.slice(0, 40)}": ${e?.message || 'error'}`)
            })
            .finally(() => setPendingSaves(c => c - 1))
    }

    // Teclado (compu): actúa sobre la captura de arriba.
    useEffect(() => {
        if (mode !== 'quick' || !current) return
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return
            const action = ACTIONS.find(a => a.key === e.key.toUpperCase())
            if (!action) return
            e.preventDefault()
            send(current, action.id)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    async function handleCapture(e: React.FormEvent) {
        e.preventDefault()
        if (!capture.trim()) return
        setCapturing(true)
        try {
            const note = await createMentalNote(capture.trim())
            setNotes(prev => [...prev, note])
            setCapture('')
        } catch (e: any) {
            setError(e?.message || 'No se pudo anotar.')
        } finally {
            setCapturing(false)
        }
    }

    const total = notes.length + doneCount

    return (
        <div className="space-y-4">
            <form onSubmit={handleCapture} className="flex gap-2">
                <input
                    value={capture}
                    onChange={e => setCapture(e.target.value)}
                    placeholder="¿Algo más dando vueltas? Anotalo acá"
                    className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                    type="submit"
                    disabled={capturing || !capture.trim()}
                    className="w-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
                    aria-label="Anotar en el Inbox"
                >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
            </form>

            {error && <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg p-2.5 break-words">{error}</p>}

            {notes.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Inbox vacío</p>
                    <p className="text-xs text-muted-foreground">
                        {doneCount > 0 ? `Moviste ${doneCount} ${doneCount === 1 ? 'captura' : 'capturas'}. ` : ''}
                        {pendingSaves > 0 ? 'Guardando…' : 'Ya podés elegir el foco del día.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Progreso + modos */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground font-mono">
                                {doneCount} de {total}
                                {pendingSaves > 0 && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" />}
                            </span>
                            <div className="flex items-center p-0.5 rounded-lg bg-secondary/50 border border-border/50">
                                {([
                                    { id: 'quick', label: 'Rápido', icon: Layers },
                                    { id: 'list', label: 'Lista', icon: List },
                                    { id: 'ai', label: 'IA', icon: Sparkles }
                                ] as const).map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMode(m.id)}
                                        className={cn(
                                            'px-2.5 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors',
                                            mode === m.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                                        )}
                                    >
                                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-amber-400 transition-[width] duration-300" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
                        </div>
                    </div>

                    {mode === 'ai' && (
                        <InboxAIProcessor notes={notes.map(n => ({ id: n.id, content: n.content }))} />
                    )}

                    {mode === 'quick' && current && (
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={current.id}
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -40, transition: { duration: 0.15 } }}
                                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                                    className="p-4 rounded-2xl bg-secondary/40 border border-border/60 space-y-4"
                                >
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {format(new Date(current.created_at), "d MMM · HH:mm", { locale: es })}
                                        </span>
                                        <AutoText
                                            value={titleOf(current)}
                                            onChange={v => setTitles(t => ({ ...t, [current.id]: v }))}
                                            className="text-base text-foreground leading-snug px-1 -mx-1"
                                        />
                                    </div>

                                    {eventFor === current.id && (
                                        <EventFields
                                            dateStr={dateStr}
                                            date={eventDate}
                                            time={eventTime}
                                            onDate={setEventDate}
                                            onTime={setEventTime}
                                            onConfirm={() => send(current, 'event')}
                                            onCancel={() => setEventFor(null)}
                                        />
                                    )}

                                    <div className="grid grid-cols-3 gap-2">
                                        {ACTIONS.map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => send(current, a.id)}
                                                className={cn(
                                                    'h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors select-none',
                                                    a.cls
                                                )}
                                            >
                                                <a.icon className="w-5 h-5" />
                                                <span>
                                                    {a.label}
                                                    <span className="hidden md:inline ml-1 font-mono text-[10px] opacity-60">{a.key}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {notes.length > 1 && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Siguen</span>
                                    {notes.slice(1, 4).map(n => (
                                        <p key={n.id} className="text-xs text-muted-foreground truncate">{n.content}</p>
                                    ))}
                                    {notes.length > 4 && <p className="text-[11px] text-muted-foreground/70">y {notes.length - 4} más</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'list' && (
                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {notes.map(note => (
                                    <motion.div
                                        key={note.id}
                                        layout
                                        exit={{ opacity: 0, x: -30, transition: { duration: 0.15 } }}
                                        className="p-3 rounded-xl bg-secondary/35 border border-border/50 space-y-2"
                                    >
                                        <AutoText
                                            value={titleOf(note)}
                                            onChange={v => setTitles(t => ({ ...t, [note.id]: v }))}
                                            className="text-sm text-foreground leading-snug px-1 -mx-1"
                                        />
                                        {eventFor === note.id && (
                                            <EventFields
                                                dateStr={dateStr}
                                                date={eventDate}
                                                time={eventTime}
                                                onDate={setEventDate}
                                                onTime={setEventTime}
                                                onConfirm={() => send(note, 'event')}
                                                onCancel={() => setEventFor(null)}
                                            />
                                        )}
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {ACTIONS.map(a => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => send(note, a.id)}
                                                    title={a.label}
                                                    aria-label={a.label}
                                                    className={cn('h-10 rounded-lg border flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors', a.cls)}
                                                >
                                                    <a.icon className="w-4 h-4 shrink-0" />
                                                    <span className="hidden sm:inline">{a.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function EventFields({ dateStr, date, time, onDate, onTime, onConfirm, onCancel }: {
    dateStr: string
    date: string
    time: string
    onDate: (v: string) => void
    onTime: (v: string) => void
    onConfirm: () => void
    onCancel: () => void
}) {
    const tomorrow = addDaysToDateStr(dateStr, 1)
    return (
        <div className="space-y-2 p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
            <div className="flex gap-1.5">
                {[{ v: dateStr, l: 'Hoy' }, { v: tomorrow, l: 'Mañana' }].map(d => (
                    <button
                        key={d.v}
                        onClick={() => onDate(d.v)}
                        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold border',
                            date === d.v ? 'bg-sky-500 text-white border-sky-500' : 'border-border text-muted-foreground')}
                    >
                        {d.l}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input type="date" value={date} onChange={e => onDate(e.target.value)} className={fieldCls} />
                <input type="time" value={time} onChange={e => onTime(e.target.value)} className={fieldCls} />
            </div>
            <div className="flex gap-2">
                <button onClick={onConfirm} className="flex-1 h-10 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold">
                    Agendar
                </button>
                <button onClick={onCancel} className="px-3 h-10 text-xs text-muted-foreground hover:text-foreground">
                    Cancelar
                </button>
            </div>
        </div>
    )
}

const fieldCls = 'w-full min-w-0 bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40'
