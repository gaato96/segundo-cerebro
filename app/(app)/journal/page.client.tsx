'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Calendar as CalendarIcon, Save, Loader2, Sparkles, PencilLine } from 'lucide-react'
import { format, subDays, addDays, isFuture } from 'date-fns'
import { es } from 'date-fns/locale'
import { getJournalEntry, saveJournalEntry } from '@/lib/actions/journal'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

export function JournalClient() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [content, setContent] = useState('')
    const [mood, setMood] = useState<number | undefined>(undefined)
    const [isEditing, setIsEditing] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

    useEffect(() => {
        async function loadEntry() {
            setIsLoading(true)
            try {
                const entry = await getJournalEntry(dateStr)
                if (entry) {
                    setContent(entry.content || '')
                    setMood(entry.mood)
                    setIsEditing(false) // Show preview if content exists
                } else {
                    setContent('')
                    setMood(undefined)
                    setIsEditing(true) // Auto edit if empty
                }
            } catch (error) {
                console.error('Error loading journal', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadEntry()
    }, [dateStr])

    // Auto-save logic
    useEffect(() => {
        if (isLoading || !isEditing) return

        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        timeoutRef.current = setTimeout(() => {
            if (content.trim()) {
                handleSave(true)
            }
        }, 2000)

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [content, mood, isEditing])

    async function handleSave(silent = false) {
        if (!content.trim()) return

        if (!silent) setIsSaving(true)
        setMessage(null)

        try {
            await saveJournalEntry(dateStr, content, mood)
            if (!silent) {
                setMessage({ text: 'Guardado correctamente', type: 'success' })
                setIsEditing(false)
                setTimeout(() => setMessage(null), 3000)
            }
        } catch (error) {
            console.error('Error saving', error)
            if (!silent) setMessage({ text: 'Error al guardar', type: 'error' })
        } finally {
            if (!silent) setIsSaving(false)
        }
    }

    const moods = [
        { value: 1, emoji: '😫', label: 'Agotado' },
        { value: 2, emoji: '😕', label: 'Regular' },
        { value: 3, emoji: '😐', label: 'Neutral' },
        { value: 4, emoji: '🙂', label: 'Bien' },
        { value: 5, emoji: '🤩', label: 'Excelente' },
    ]

    const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1))
    const handleNextDay = () => {
        if (!isFuture(addDays(selectedDate, 1))) {
            setSelectedDate(prev => addDays(prev, 1))
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header & Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Brain Dump
                        <Sparkles className="w-6 h-6 text-indigo-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Vaciá tu mente para ganar enfoque. Soporta Markdown.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-secondary/50 p-1.5 rounded-xl border border-border">
                    <button
                        onClick={handlePrevDay}
                        className="px-3 py-1.5 rounded-lg hover:bg-background text-sm font-medium transition-colors border border-transparent hover:border-border"
                    >
                        Ayer
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-border text-sm font-medium min-w-[140px] justify-center text-indigo-300 shadow-inner">
                        <CalendarIcon className="w-4 h-4 text-indigo-400" />
                        {isToday ? 'Hoy' : format(selectedDate, 'd MMM YYY', { locale: es })}
                    </div>
                    <button
                        onClick={handleNextDay}
                        disabled={isFuture(addDays(selectedDate, 1))}
                        className="px-3 py-1.5 rounded-lg hover:bg-background text-sm font-medium transition-colors border border-transparent hover:border-border disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
                    >
                        Mañana
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col min-h-[60vh]">
                {/* Toolbar */}
                <div className="border-b border-border/50 bg-secondary/30 p-4 flex flex-wrap items-center justify-between gap-4">
                    {/* Mood Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-muted-foreground mr-2">¿Cómo te sentís?</span>
                        {moods.map(m => (
                            <button
                                key={m.value}
                                onClick={() => {
                                    setMood(m.value)
                                    if (!isEditing) setIsEditing(true)
                                }}
                                disabled={isLoading}
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50',
                                    mood === m.value ? 'bg-indigo-500/20 ring-2 ring-indigo-500/50 scale-110' : 'grayscale hover:grayscale-0'
                                )}
                                title={m.label}
                            >
                                {m.emoji}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {message && (
                            <span className={`text-xs px-3 py-1 rounded-full ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {message.text}
                            </span>
                        )}

                        <div className="bg-background rounded-lg p-1 flex items-center border border-border shadow-inner">
                            <button
                                onClick={() => setIsEditing(true)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
                                    isEditing ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <PencilLine className="w-4 h-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
                                    !isEditing ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Sparkles className="w-4 h-4" />
                                Preview
                            </button>
                        </div>

                        <button
                            onClick={() => handleSave(false)}
                            disabled={isLoading || isSaving}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                    </div>
                </div>

                {/* Editor / Preview Area */}
                <div className="flex-1 relative bg-background/50">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : isEditing ? (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribí acá lo que tenés en la cabeza. Podés usar **negritas**, - listas, o # títulos..."
                            className="w-full h-full min-h-[500px] p-6 bg-transparent resize-none focus:outline-none text-foreground leading-relaxed text-base md:text-lg placeholder:text-muted-foreground/50"
                            autoFocus
                        />
                    ) : (
                        <div className="p-6 prose prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-pre:bg-secondary/50 min-h-[500px]">
                            {content ? (
                                <ReactMarkdown>{content}</ReactMarkdown>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic h-[400px]">
                                    <PencilLine className="w-12 h-12 mb-4 opacity-20" />
                                    <p>No hay entradas para este día.</p>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="mt-4 text-indigo-400 hover:text-indigo-300 not-italic text-sm font-medium"
                                    >
                                        Empezar a escribir...
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
