'use client'

import { useMemo, useState } from 'react'
import { Plus, Loader2, Check } from 'lucide-react'
import { createQuickTask } from '@/lib/actions/tasks'
import { useRouter } from 'next/navigation'
import { parseQuick } from '@/lib/nlParse'
import { getLocalDateStr } from '@/lib/utils'

interface QuickTaskInputProps {
    defaultCategory?: string
}

/**
 * Entrada rápida en lenguaje natural: "llamar al contador el jueves 10hs"
 * guarda la tarea con fecha y recordatorio. Muestra lo que entendió antes.
 */
export function QuickTaskInput({ defaultCategory = 'Personal' }: QuickTaskInputProps) {
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState(defaultCategory)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const parsed = useMemo(() => (title.trim() ? parseQuick(title, getLocalDateStr()) : null), [title])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!parsed || loading) return
        setLoading(true)
        try {
            await createQuickTask(parsed.title, category, { due_date: parsed.date, reminder_time: parsed.time, priority: parsed.priority })
            setTitle('')
            router.refresh()
        } catch (error) {
            console.error('Failed to create quick task:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-1.5">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Nueva tarea: “llamar al contador el jueves 10hs”"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={loading}
                        className="field pr-28"
                    />
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 bg-card text-xs text-muted-foreground border border-hairline rounded-lg px-2 focus:outline-none cursor-pointer"
                    >
                        <option value="Personal">Personal</option>
                        <option value="Work">Trabajo</option>
                    </select>
                </div>
                <button type="submit" disabled={!parsed || loading} aria-label="Agregar tarea" className="btn-primary !px-3.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
            </div>
            {parsed && parsed.summary.length > 0 && (
                <p className="text-xs text-muted-foreground px-1 flex flex-wrap items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-foreground">{parsed.title}</span>
                    {parsed.summary.map(s => <span key={s} className="font-mono text-[11px] px-1.5 rounded-md bg-raised border border-hairline">{s}</span>)}
                </p>
            )}
        </form>
    )
}
