'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sun, CheckSquare, Calendar, Lightbulb, Archive, Loader2, Plus, Sparkles, Inbox, Check
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { applyInboxSuggestion, type NoteDestination } from '@/lib/actions/inbox_ai'
import { createMentalNote } from '@/lib/actions/mental_notes'
import { InboxAIProcessor } from '@/components/inbox/InboxAIProcessor'
import { cn } from '@/lib/utils'
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
}

type Action = 'today' | 'task' | 'event' | 'idea' | 'note'

const ACTIONS: { id: Action; label: string; icon: any; cls: string }[] = [
    { id: 'today', label: 'Hoy', icon: Sun, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500 hover:text-black' },
    { id: 'task', label: 'Tarea', icon: CheckSquare, cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25 hover:bg-indigo-500 hover:text-white' },
    { id: 'event', label: 'Evento', icon: Calendar, cls: 'bg-sky-500/10 text-sky-300 border-sky-500/25 hover:bg-sky-500 hover:text-white' },
    { id: 'idea', label: 'Idea', icon: Lightbulb, cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/25 hover:bg-yellow-500 hover:text-black' },
    { id: 'note', label: 'Archivar', icon: Archive, cls: 'bg-secondary/60 text-muted-foreground border-border hover:text-foreground' }
]

/**
 * Paso 1 del plan del día: vaciar el Inbox.
 * Cada captura sale con un toque: a hoy, a tareas, a la agenda, al banco de ideas
 * o al archivo. El título se puede retocar antes de mandarla.
 */
export function InboxTriage({ notes: initialNotes, dateStr }: Props) {
    const router = useRouter()
    const [notes, setNotes] = useState(initialNotes)
    const [titles, setTitles] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState<string | null>(null)
    const [eventFor, setEventFor] = useState<string | null>(null)
    const [eventDate, setEventDate] = useState(dateStr)
    const [eventTime, setEventTime] = useState('')
    const [capture, setCapture] = useState('')
    const [capturing, setCapturing] = useState(false)
    const [useAI, setUseAI] = useState(false)
    const [error, setError] = useState('')
    const [doneCount, setDoneCount] = useState(0)

    const titleOf = (n: Note) => titles[n.id] ?? n.content.replace(/\s+/g, ' ').trim().slice(0, 160)

    async function send(note: Note, action: Action) {
        if (action === 'event' && eventFor !== note.id) {
            setEventFor(note.id)
            setEventDate(dateStr)
            setEventTime('')
            return
        }
        setBusy(note.id)
        setError('')
        const destination: NoteDestination = action === 'today' ? 'task' : action
        try {
            await applyInboxSuggestion({
                note_id: note.id,
                destination,
                title: titleOf(note) || note.content.slice(0, 120),
                description: note.content,
                planned_date: action === 'today' ? dateStr : null,
                event_date: action === 'event' ? eventDate : null,
                start_time: action === 'event' ? eventTime || null : null,
                reason: ''
            })
            setNotes(prev => prev.filter(n => n.id !== note.id))
            setDoneCount(c => c + 1)
            setEventFor(null)
            router.refresh()
        } catch (e: any) {
            setError(e?.message || 'No se pudo mover la captura.')
        } finally {
            setBusy(null)
        }
    }

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

    return (
        <div className="space-y-4">
            {/* Captura rápida: si al planificar se te viene algo, va acá también */}
            <form onSubmit={handleCapture} className="flex gap-2">
                <input
                    value={capture}
                    onChange={e => setCapture(e.target.value)}
                    placeholder="¿Algo más dando vueltas? Anotalo acá"
                    className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                    type="submit"
                    disabled={capturing || !capture.trim()}
                    className="px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center"
                    aria-label="Anotar en el Inbox"
                >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
            </form>

            {error && <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg p-2.5">{error}</p>}

            {notes.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Inbox vacío</p>
                    <p className="text-xs text-muted-foreground">
                        {doneCount > 0 ? `Moviste ${doneCount} ${doneCount === 1 ? 'captura' : 'capturas'}. ` : ''}
                        Ya podés elegir el foco del día.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Inbox className="w-3.5 h-3.5" />
                            {notes.length} {notes.length === 1 ? 'captura' : 'capturas'} por mover
                        </span>
                        <button
                            onClick={() => setUseAI(v => !v)}
                            className="text-[11px] font-semibold text-violet-300 hover:text-violet-200 flex items-center gap-1"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            {useAI ? 'Hacerlo a mano' : 'Que la IA clasifique todo'}
                        </button>
                    </div>

                    {useAI ? (
                        <InboxAIProcessor notes={notes.map(n => ({ id: n.id, content: n.content }))} />
                    ) : (
                        <div className="space-y-2.5">
                            <AnimatePresence mode="popLayout">
                                {notes.map(note => (
                                    <motion.div
                                        key={note.id}
                                        layout
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -24 }}
                                        className="p-3.5 rounded-2xl bg-secondary/35 border border-border/50 space-y-2.5"
                                    >
                                        <div className="flex items-start gap-2">
                                            <textarea
                                                value={titleOf(note)}
                                                onChange={e => setTitles(t => ({ ...t, [note.id]: e.target.value }))}
                                                rows={Math.min(3, Math.ceil(titleOf(note).length / 60) || 1)}
                                                className="flex-1 min-w-0 bg-transparent text-sm text-foreground leading-snug resize-none focus:outline-none focus:bg-black/20 rounded-lg px-1 -mx-1"
                                            />
                                            <span className="text-[10px] text-muted-foreground/70 shrink-0 pt-0.5">
                                                {format(new Date(note.created_at), 'd MMM HH:mm', { locale: es })}
                                            </span>
                                        </div>

                                        {eventFor === note.id && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={fieldCls} />
                                                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className={fieldCls} />
                                                <button
                                                    onClick={() => send(note, 'event')}
                                                    disabled={busy === note.id}
                                                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold"
                                                >
                                                    Agendar
                                                </button>
                                                <button onClick={() => setEventFor(null)} className="text-[11px] text-muted-foreground hover:text-foreground">
                                                    Cancelar
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-1.5">
                                            {busy === note.id ? (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 py-1">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Moviendo…
                                                </span>
                                            ) : ACTIONS.map(a => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => send(note, a.id)}
                                                    disabled={!!busy}
                                                    className={cn(
                                                        'px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40',
                                                        a.cls
                                                    )}
                                                >
                                                    <a.icon className="w-3.5 h-3.5" />
                                                    {a.label}
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

const fieldCls = 'bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40'
