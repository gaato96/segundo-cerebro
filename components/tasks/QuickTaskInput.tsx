'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { createQuickTask } from '@/lib/actions/tasks'
import { useRouter } from 'next/navigation'

interface QuickTaskInputProps {
    defaultCategory?: string
}

export function QuickTaskInput({ defaultCategory = 'Personal' }: QuickTaskInputProps) {
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState(defaultCategory)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || loading) return

        setLoading(true)
        try {
            await createQuickTask(title.trim(), category)
            setTitle('')
            router.refresh()
        } catch (error) {
            console.error('Failed to create quick task:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
                <input
                    type="text"
                    placeholder="⚡ Agregar tarea rápida (Presioná Enter)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                    className="w-full bg-secondary/80 border border-border/80 hover:border-indigo-500/40 focus:border-indigo-500 rounded-xl pl-4 pr-24 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-sm"
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="bg-muted/80 text-[11px] font-medium text-muted-foreground border border-border rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                    >
                        <option value="Personal">Personal</option>
                        <option value="Work">Trabajo</option>
                    </select>
                </div>
            </div>

            <button
                type="submit"
                disabled={!title.trim() || loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-all shadow-md flex items-center justify-center shrink-0"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
        </form>
    )
}
