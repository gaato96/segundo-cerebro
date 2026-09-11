'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Loader2, CheckSquare, Calendar, BookOpen, Heart,
    FileText, Trash2, Check, X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    suggestInboxActions, applyInboxSuggestions,
    type NoteSuggestion, type NoteDestination
} from '@/lib/actions/inbox_ai'
import { cn } from '@/lib/utils'

interface Props {
    notes: { id: string; content: string }[]
}

const DESTINATIONS: { id: NoteDestination; label: string; icon: any; color: string }[] = [
    { id: 'task', label: 'Tarea', icon: CheckSquare, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
    { id: 'event', label: 'Evento', icon: Calendar, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
    { id: 'journal', label: 'Journal', icon: BookOpen, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
    { id: 'wishlist', label: 'Deseo', icon: Heart, color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
    { id: 'note', label: 'Solo archivar', icon: FileText, color: 'text-muted-foreground border-border bg-secondary/50' },
    { id: 'discard', label: 'Descartar', icon: Trash2, color: 'text-red-400 border-red-500/30 bg-red-500/10' }
]

export function InboxAIProcessor({ notes }: Props) {
    const router = useRouter()
    const [suggestions, setSuggestions] = useState<NoteSuggestion[] | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const noteById = new Map(notes.map(n => [n.id, n.content]))

    async function handleSuggest() {
        setLoading(true)
        setError(null)
        try {
            const result = await suggestInboxActions()
            setSuggestions(result)
            // Todo viene marcado menos lo que propone descartar: eso se confirma a mano.
            setSelected(new Set(result.filter(s => s.destination !== 'discard').map(s => s.note_id)))
        } catch (e: any) {
            setError(e?.message || 'No se pudo analizar el inbox.')
        } finally {
            setLoading(false)
        }
    }

    async function handleApply() {
        if (!suggestions) return
        const toApply = suggestions.filter(s => selected.has(s.note_id))
        if (!toApply.length) return

        setApplying(true)
        setError(null)
        try {
            const res = await applyInboxSuggestions(toApply)
            if (res.failures.length) {
                setError(`Se aplicaron ${res.applied}. Fallaron: ${res.failures.join(' · ')}`)
            }
            setSuggestions(null)
            setSelected(new Set())
            router.refresh()
        } catch (e: any) {
            setError(e?.message)
        } finally {
            setApplying(false)
        }
    }

    function update(noteId: string, patch: Partial<NoteSuggestion>) {
        setSuggestions(prev => prev?.map(s => (s.note_id === noteId ? { ...s, ...patch } : s)) || null)
    }

    function toggle(noteId: string) {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(noteId)) next.delete(noteId)
            else next.add(noteId)
            return next
        })
    }

    if (!notes.length) return null

    return (
        <div className="space-y-3">
            {!suggestions && (
                <div className="glass p-4 rounded-2xl border border-violet-500/25 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground">Procesar con IA</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            Propone a dónde va cada captura. Vos confirmás: no escribe nada sin tu OK.
                        </p>
                    </div>
                    <button
                        onClick={handleSuggest}
                        disabled={loading}
                        className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {loading ? 'Leyendo tus capturas…' : `Analizar ${notes.length}`}
                    </button>
                </div>
            )}

            {error && (
                <p className="text-[11px] text-red-400 px-1">{error}</p>
            )}

            <AnimatePresence>
                {suggestions && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        <div className="flex items-center justify-between gap-2 sticky top-0 z-10 glass p-3 rounded-xl border border-border/50">
                            <span className="text-xs font-semibold text-foreground">
                                {selected.size} de {suggestions.length} seleccionadas
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setSuggestions(null); setSelected(new Set()) }}
                                    className="px-3 py-1.5 glass border border-border/50 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={applying || !selected.size}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Aplicar
                                </button>
                            </div>
                        </div>

                        {suggestions.map(s => {
                            const isSelected = selected.has(s.note_id)
                            const dest = DESTINATIONS.find(d => d.id === s.destination) || DESTINATIONS[4]

                            return (
                                <div
                                    key={s.note_id}
                                    className={cn(
                                        'glass p-4 rounded-2xl border space-y-3 transition-all',
                                        isSelected ? 'border-violet-500/30' : 'border-border/40 opacity-55'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={() => toggle(s.note_id)}
                                            className={cn(
                                                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                                                isSelected
                                                    ? 'bg-violet-600 border-violet-600 text-white'
                                                    : 'border-border text-transparent hover:border-violet-500/50'
                                            )}
                                        >
                                            {isSelected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                        </button>

                                        <p className="text-[11px] text-muted-foreground italic leading-relaxed flex-1 min-w-0">
                                            &ldquo;{(noteById.get(s.note_id) || '').slice(0, 160)}&rdquo;
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 pl-8">
                                        {DESTINATIONS.map(d => {
                                            const Icon = d.icon
                                            const active = s.destination === d.id
                                            return (
                                                <button
                                                    key={d.id}
                                                    onClick={() => update(s.note_id, { destination: d.id })}
                                                    className={cn(
                                                        'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all',
                                                        active ? d.color : 'border-transparent text-muted-foreground hover:bg-secondary/60'
                                                    )}
                                                >
                                                    <Icon className="w-3 h-3" />
                                                    {d.label}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {s.destination !== 'discard' && s.destination !== 'note' && (
                                        <div className="pl-8 space-y-2">
                                            <input
                                                value={s.title}
                                                onChange={e => update(s.note_id, { title: e.target.value })}
                                                className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                                            />

                                            {s.destination === 'task' && (
                                                <div className="flex flex-wrap gap-2">
                                                    <select
                                                        value={s.priority}
                                                        onChange={e => update(s.note_id, { priority: Number(e.target.value) as 1 | 2 | 3 })}
                                                        className={selectCls}
                                                    >
                                                        <option value={1}>Prioridad alta</option>
                                                        <option value={2}>Prioridad media</option>
                                                        <option value={3}>Prioridad baja</option>
                                                    </select>
                                                    <select
                                                        value={s.category}
                                                        onChange={e => update(s.note_id, { category: e.target.value as 'Work' | 'Personal' })}
                                                        className={selectCls}
                                                    >
                                                        <option value="Personal">Personal</option>
                                                        <option value="Work">Trabajo</option>
                                                    </select>
                                                    <input
                                                        type="date"
                                                        value={s.due_date || ''}
                                                        onChange={e => update(s.note_id, { due_date: e.target.value || null })}
                                                        className={selectCls}
                                                    />
                                                </div>
                                            )}

                                            {s.destination === 'event' && (
                                                <div className="flex flex-wrap gap-2">
                                                    <input
                                                        type="date"
                                                        value={s.event_date || ''}
                                                        onChange={e => update(s.note_id, { event_date: e.target.value || null })}
                                                        className={selectCls}
                                                    />
                                                    <input
                                                        type="time"
                                                        value={s.start_time || ''}
                                                        onChange={e => update(s.note_id, { start_time: e.target.value || null })}
                                                        className={selectCls}
                                                    />
                                                </div>
                                            )}

                                            {s.destination === 'wishlist' && (
                                                <input
                                                    type="number"
                                                    value={s.price ?? ''}
                                                    placeholder="Precio estimado"
                                                    onChange={e => update(s.note_id, { price: e.target.value ? Number(e.target.value) : null })}
                                                    className={selectCls}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {s.reason && (
                                        <p className="text-[10px] text-violet-300/70 pl-8 leading-relaxed">{s.reason}</p>
                                    )}
                                </div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const selectCls = 'bg-secondary/60 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40'
