'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, Loader2, ArrowRight, Check } from 'lucide-react'
import { createMentalNote } from '@/lib/actions/mental_notes'

/**
 * Captura al Inbox desde el dashboard. Reemplaza a las notas adhesivas:
 * todo lo que se te cruza va a un solo lugar, y después la IA lo reparte
 * (tarea, evento, gasto, idea, journal, algo para ver…).
 */
export function InboxCaptureWidget({ pending }: { pending: number }) {
    const router = useRouter()
    const [text, setText] = useState('')
    const [saving, setSaving] = useState(false)
    const [count, setCount] = useState(pending)
    const [flash, setFlash] = useState(false)

    async function save() {
        const content = text.trim()
        if (!content || saving) return
        setSaving(true)
        try {
            await createMentalNote(content)
            setText('')
            setCount(c => c + 1)
            setFlash(true)
            setTimeout(() => setFlash(false), 1500)
            router.refresh()
        } catch {
            alert('No se pudo guardar. Probá de nuevo.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="glass p-4 rounded-2xl border border-border/50 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-sky-400" /> Sacalo de la cabeza
                </h3>
                <Link href="/inbox" className="text-[11px] text-muted-foreground hover:text-white flex items-center gap-1">
                    {count > 0 ? `${count} sin procesar` : 'Inbox'} <ArrowRight className="w-3 h-3" />
                </Link>
            </div>
            <form
                onSubmit={e => { e.preventDefault(); save() }}
                className="flex gap-2"
            >
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Tarea, gasto, idea, serie para ver, algo que pasó…"
                    className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                    type="submit"
                    disabled={!text.trim() || saving}
                    className="px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : flash ? <Check className="w-3.5 h-3.5" /> : null}
                    {flash ? 'Guardado' : 'Guardar'}
                </button>
            </form>
            <p className="text-[10px] text-muted-foreground">No lo clasifiques ahora. En el Inbox la IA te propone a dónde va cada cosa.</p>
        </div>
    )
}
