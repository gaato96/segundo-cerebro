'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Palette } from 'lucide-react'
import { createStickyNote, updateStickyNote, deleteStickyNote } from '@/lib/actions/sticky_notes'
import { cn } from '@/lib/utils'

interface StickyNote {
    id: string
    content: string
    color: string
    position_index: number
}

interface StickyNotesWidgetProps {
    initialNotes: StickyNote[]
}

const COLORS = [
    'bg-yellow-200 text-yellow-900 border-yellow-300',
    'bg-pink-200 text-pink-900 border-pink-300',
    'bg-blue-200 text-blue-900 border-blue-300',
    'bg-green-200 text-green-900 border-green-300',
    'bg-purple-200 text-purple-900 border-purple-300',
]

export function StickyNotesWidget({ initialNotes }: StickyNotesWidgetProps) {
    const [notes, setNotes] = useState<StickyNote[]>(initialNotes)
    const [isCreating, setIsCreating] = useState(false)

    // Sync with server if initialNotes changes
    useEffect(() => {
        setNotes(initialNotes)
    }, [initialNotes])

    const handleAddNote = async () => {
        if (isCreating) return
        setIsCreating(true)
        try {
            const newNote = await createStickyNote('', COLORS[0])
            if (newNote && 'isError' in newNote) {
                alert("Database Error: " + newNote.message)
                return
            }
            setNotes(prev => [...prev, newNote as any])
        } catch (error) {
            console.error('Failed to create note', error)
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-heading font-semibold">Post-its</h3>
                <button
                    onClick={handleAddNote}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Nota
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-start">
                {notes.map(note => (
                    <StickyNoteItem
                        key={note.id}
                        note={note}
                        onDelete={(id) => {
                            setNotes(prev => prev.filter(n => n.id !== id))
                        }}
                    />
                ))}
                {notes.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                        No tienes notas fijadas. Crea una para recordarte cosas importantes.
                    </div>
                )}
            </div>
        </div>
    )
}

function StickyNoteItem({ note, onDelete }: { note: StickyNote, onDelete: (id: string) => void }) {
    const [content, setContent] = useState(note.content)
    const [color, setColor] = useState(note.color)
    const [isHovered, setIsHovered] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const handleContentChange = (newContent: string) => {
        setContent(newContent)

        // Debounce update
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            updateStickyNote(note.id, { content: newContent })
        }, 1000)
    }

    const handleChangeColor = async (newColor: string) => {
        setColor(newColor)
        await updateStickyNote(note.id, { color: newColor })
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteStickyNote(note.id)
            onDelete(note.id)
        } catch (error) {
            console.error('Failed to delete note', error)
            setIsDeleting(false)
        }
    }

    return (
        <div
            className={cn(
                "relative flex flex-col p-3 rounded-lg shadow-md hover:shadow-lg transition-all min-h-[140px] border",
                color,
                isDeleting && "opacity-50 pointer-events-none"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Escribe algo..."
                className="flex-1 w-full bg-transparent resize-none outline-none placeholder:text-inherit placeholder:opacity-60 text-sm font-medium"
            />

            {/* Toolbar that appears on hover */}
            <div className={cn(
                "absolute bottom-2 right-2 flex items-center gap-1 transition-opacity duration-200",
                isHovered ? "opacity-100" : "opacity-0"
            )}>
                <div className="relative group/color">
                    <button className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-black/60 hover:text-black">
                        <Palette className="w-4 h-4" />
                    </button>
                    {/* Color picker dropdown on hover over toolbar button */}
                    <div className="absolute bottom-full right-0 mb-1 hidden group-hover/color:flex bg-white rounded-full shadow-lg p-1 gap-1 border">
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => handleChangeColor(c)}
                                className={cn("w-5 h-5 rounded-full border border-black/10", c.split(' ')[0])}
                            />
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-black/60 hover:text-red-600"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
