'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Loader2, X, Check, CornerDownLeft } from 'lucide-react'
import { captureItem, type CaptureKind } from '@/lib/actions/capture'
import { parseQuick } from '@/lib/nlParse'
import { getLocalDateStr, cn } from '@/lib/utils'

/**
 * Captura universal.
 *
 * Se abre con la tecla C (fuera de un campo de texto), Ctrl/Cmd+Shift+K, el
 * botón "Capturar" de la barra, el + del celular o el command palette
 * (evento `sc:quick-capture`, que puede traer { text, kind }).
 *
 * Sin tipo, todo cae al Inbox y se clasifica después. Con tipo va directo a
 * su lugar, entendiendo "el jueves 10hs". También se puede dictar.
 */

type ChipKind = CaptureKind | 'expense'

const KINDS: { id: ChipKind; label: string; dot: string }[] = [
    { id: 'task', label: 'Tarea', dot: 'bg-graphite-300' },
    { id: 'event', label: 'Evento', dot: 'bg-sky-400' },
    { id: 'idea', label: 'Idea', dot: 'bg-amber-400' },
    { id: 'expense', label: 'Gasto', dot: 'bg-emerald-400' },
    { id: 'note', label: 'Nota', dot: 'bg-graphite-400' }
]

function isTyping(el: EventTarget | null) {
    const t = el as HTMLElement | null
    if (!t) return false
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

export function QuickCaptureButton() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [text, setText] = useState('')
    const [kind, setKind] = useState<ChipKind | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [listening, setListening] = useState(false)
    const [voiceUsed, setVoiceUsed] = useState(false)
    const [toast, setToast] = useState<{ label: string; url: string } | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const recRef = useRef<any>(null)

    const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen(true)
                return
            }
            if (!open && e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
                // No pisar otros modales abiertos
                if (document.querySelector('[role="dialog"]')) return
                e.preventDefault()
                setOpen(true)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        const onRequest = (e: Event) => {
            const detail = (e as CustomEvent).detail || {}
            if (detail.text) setText(detail.text)
            if (detail.kind) setKind(detail.kind)
            setOpen(true)
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('sc:quick-capture', onRequest)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('sc:quick-capture', onRequest)
        }
    }, [open])

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 30)
        else {
            recRef.current?.stop?.()
            setListening(false)
            setError('')
        }
    }, [open])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3200)
        return () => clearTimeout(t)
    }, [toast])

    const preview = useMemo(() => {
        if (kind !== 'task' && kind !== 'event') return null
        if (!text.trim()) return null
        return parseQuick(text, getLocalDateStr())
    }, [text, kind])

    function toggleVoice() {
        if (listening) {
            recRef.current?.stop()
            return
        }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) return
        const rec = new SR()
        rec.lang = 'es-AR'
        rec.interimResults = true
        rec.continuous = false
        const base = text ? `${text.trim()} ` : ''
        rec.onresult = (ev: any) => {
            let transcript = ''
            for (let i = 0; i < ev.results.length; i++) transcript += ev.results[i][0].transcript
            setText(base + transcript)
        }
        rec.onend = () => setListening(false)
        rec.onerror = () => setListening(false)
        recRef.current = rec
        setVoiceUsed(true)
        setListening(true)
        rec.start()
    }

    async function save() {
        if (!text.trim() || saving) return
        if (kind === 'expense') {
            setOpen(false)
            const amount = text.match(/\d[\d.,]*/)?.[0]?.replace(/\./g, '').replace(',', '.')
            window.dispatchEvent(new CustomEvent('sc:quick-expense', { detail: { kind: 'expense', amount: amount ? Number(amount) : undefined, description: text.replace(/\$?\s*\d[\d.,]*/, '').trim() } }))
            setText('')
            setKind(null)
            return
        }
        setSaving(true)
        setError('')
        const res = await captureItem({ text, kind: kind || 'inbox', source: voiceUsed ? 'voice' : 'keyboard' })
        setSaving(false)
        if (!res.ok) return setError(res.error)
        setToast({ label: res.data.label, url: res.data.url })
        setText('')
        setKind(null)
        setVoiceUsed(false)
        setOpen(false)
        window.dispatchEvent(new CustomEvent('sc:captured'))
        router.refresh()
    }

    function cycleKind(back = false) {
        const order: (ChipKind | null)[] = [null, ...KINDS.map(k => k.id)]
        const i = order.indexOf(kind)
        setKind(order[(i + (back ? -1 : 1) + order.length) % order.length])
    }

    return (
        <>
            <AnimatePresence>
                {open && (
                    <div className="fixed inset-0 z-[90] flex items-end sm:items-start justify-center sm:pt-[14vh]" role="dialog" aria-label="Captura rápida">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 24 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                            className="relative w-full sm:max-w-[560px] bg-card border border-hairline rounded-t-3xl sm:rounded-2xl shadow-2xl"
                            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                        >
                            <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-raised" />
                            <div className="flex items-center justify-between px-5 pt-4">
                                <p className="label-caps flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Captura rápida
                                </p>
                                <button onClick={() => setOpen(false)} aria-label="Cerrar" className="w-9 h-9 -mr-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-5 pt-3 pb-4 space-y-3">
                                <div className="relative rounded-2xl bg-raised border border-hairline focus-within:ring-2 focus-within:ring-amber-400/50">
                                    <textarea
                                        ref={inputRef}
                                        value={text}
                                        onChange={e => setText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
                                            if (e.key === 'Tab') { e.preventDefault(); cycleKind(e.shiftKey) }
                                        }}
                                        rows={2}
                                        placeholder="¿Qué se te cruzó?"
                                        className="w-full bg-transparent resize-none px-4 pt-3.5 pb-2 text-base text-foreground placeholder:text-ink-faint focus:outline-none min-h-[72px]"
                                    />
                                    <div className="flex items-center justify-between px-3 pb-2.5">
                                        {speechSupported ? (
                                            <button
                                                onClick={toggleVoice}
                                                aria-label={listening ? 'Dejar de dictar' : 'Dictar'}
                                                className={cn(
                                                    'w-9 h-9 rounded-full flex items-center justify-center border transition-colors',
                                                    listening ? 'bg-red-400/15 border-red-400/40 text-red-300' : 'border-hairline text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                            </button>
                                        ) : <span />}
                                        <span className="font-mono text-[10px] text-ink-faint">
                                            {listening ? 'Escuchando…' : kind ? '' : 'Sin tipo: va al Inbox'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                                    {KINDS.map(k => (
                                        <button
                                            key={k.id}
                                            onClick={() => setKind(kind === k.id ? null : k.id)}
                                            className={cn(
                                                'h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors',
                                                kind === k.id ? 'lamp text-amber-200' : 'bg-raised/60 border-hairline text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            <span className={cn('w-1.5 h-1.5 rounded-full', k.dot)} />
                                            {k.label}
                                        </button>
                                    ))}
                                </div>

                                {preview && (
                                    <div className="rounded-xl border border-hairline bg-raised/40 px-3.5 py-2.5 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="text-emerald-300 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Entendí</span>
                                        <span className="font-medium text-foreground">{preview.title}</span>
                                        {preview.summary.map(s => (
                                            <span key={s} className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-raised border border-hairline text-muted-foreground">{s}</span>
                                        ))}
                                    </div>
                                )}

                                {error && <p className="text-xs text-red-300">{error}</p>}

                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <p className="hidden sm:block font-mono text-[10px] text-ink-faint">
                                        Enter guarda · Tab elige tipo · Esc cierra
                                    </p>
                                    <button onClick={save} disabled={saving || !text.trim()} className="btn-primary w-full sm:w-auto text-sm">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CornerDownLeft className="w-4 h-4" />}
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.a
                        href={toast.url}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        className="fixed z-[95] left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 flex items-center gap-2 px-4 h-11 rounded-xl bg-card border border-hairline shadow-2xl text-sm"
                    >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Guardado</span>
                        <span className="text-muted-foreground">· {toast.label}</span>
                    </motion.a>
                )}
            </AnimatePresence>
        </>
    )
}
