'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Trash2, ArrowRight, Loader2, Brain, Calendar, Flag, Zap } from 'lucide-react'
import { processMentalNote, deleteMentalNote } from '@/lib/actions/mental_notes'
import { createTask } from '@/lib/actions/tasks'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface MentalNote {
    id: string
    content: string
    created_at: string
}

interface InboxListProps {
    initialNotes: MentalNote[]
    userId: string
}

export function InboxList({ initialNotes, userId }: InboxListProps) {
    const [notes, setNotes] = useState(initialNotes)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const router = useRouter()

    async function handleProcess(id: string) {
        setLoadingId(id)
        try {
            await processMentalNote(id)
            setNotes(prev => prev.filter(n => n.id !== id))
        } catch (error) {
            console.error('Failed to process note:', error)
        } finally {
            setLoadingId(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar esta nota?')) return
        setLoadingId(id)
        try {
            await deleteMentalNote(id)
            setNotes(prev => prev.filter(n => n.id !== id))
        } catch (error) {
            console.error('Failed to delete note:', error)
        } finally {
            setLoadingId(null)
        }
    }

    async function handleConvertToTask(note: MentalNote) {
        setProcessingId(note.id)
        try {
            const formData = new FormData()
            formData.append('title', note.content.slice(0, 50) + (note.content.length > 50 ? '...' : ''))
            formData.append('description', note.content)
            formData.append('priority', '2')
            formData.append('category', 'Personal')
            formData.append('energy_level', 'Deep Work')

            await createTask(formData)
            await processMentalNote(note.id)

            setNotes(prev => prev.filter(n => n.id !== note.id))
            router.refresh()
        } catch (error) {
            console.error('Failed to convert note to task:', error)
        } finally {
            setProcessingId(null)
        }
    }

    if (notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-2xl border border-dashed border-border">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                    <Brain className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Tu Inbox está vacío</h2>
                <p className="text-muted-foreground mt-2 max-w-xs">
                    ¡Excelente! No tenés capturas pendientes de procesar.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <AnimatePresence mode="popLayout">
                {notes.map((note) => (
                    <motion.div
                        key={note.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, x: -20 }}
                        className="glass p-5 rounded-2xl border border-border/50 group hover:border-indigo-500/30 transition-all"
                    >
                        <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-muted-foreground mb-1 block">
                                    Capturado el {format(new Date(note.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                                </span>
                                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                <button
                                    onClick={() => handleConvertToTask(note)}
                                    disabled={!!processingId || !!loadingId}
                                    title="Convertir a Tarea"
                                    className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-500/20 flex items-center gap-2 text-sm font-medium"
                                >
                                    {processingId === note.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <ArrowRight className="w-4 h-4" />
                                            <span>Tarea</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleProcess(note.id)}
                                    disabled={!!processingId || !!loadingId}
                                    title="Marcar como procesado"
                                    className="p-2.5 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
                                >
                                    {loadingId === note.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                </button>

                                <button
                                    onClick={() => handleDelete(note.id)}
                                    disabled={!!processingId || !!loadingId}
                                    title="Eliminar captura"
                                    className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
