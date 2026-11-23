'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CornerDownLeft, Loader2 } from 'lucide-react'
import { createQuickTask } from '@/lib/actions/tasks'
import { parseQuick } from '@/lib/nlParse'
import { getLocalDateStr } from '@/lib/utils'

/**
 * Un objetivo activo sin ninguna tarea abierta no avanza solo.
 * Esto lo marca y deja crear el próximo paso ahí mismo, ya vinculado.
 */
export function NextStepPrompt({ objectiveId }: { objectiveId: string }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [text, setText] = useState('')
    const [saving, setSaving] = useState(false)

    async function save(e: React.FormEvent) {
        e.preventDefault()
        if (!text.trim()) return
        setSaving(true)
        const p = parseQuick(text, getLocalDateStr())
        await createQuickTask(p.title, 'Personal', { due_date: p.date, reminder_time: p.time, priority: p.priority, objective_id: objectiveId })
        setSaving(false)
        setText('')
        setOpen(false)
        router.refresh()
    }

    return (
        <div className="rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2 text-foreground/90">
                    <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
                    Sin tareas abiertas: este objetivo no avanza solo.
                </span>
                {!open && (
                    <button onClick={() => setOpen(true)} className="text-xs font-medium underline underline-offset-4 decoration-hairline hover:text-foreground">
                        Crear el próximo paso
                    </button>
                )}
            </div>
            {open && (
                <form onSubmit={save} className="relative mt-3">
                    <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Ej: mandar 3 propuestas el viernes" className="field !min-h-10 h-10 pr-11 text-sm" />
                    <button type="submit" disabled={saving || !text.trim()} aria-label="Crear" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CornerDownLeft className="w-4 h-4" />}
                    </button>
                </form>
            )}
        </div>
    )
}
