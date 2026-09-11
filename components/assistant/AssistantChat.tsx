'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Send, Loader2, User, Sparkles, Plus, CheckCircle2,
    HeartHandshake, Flame, Coffee, Briefcase, Target, Apple
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { PERSONA_LIST, getPersona, type PersonaId } from '@/lib/assistantPersonas'
import { sendAssistantMessage, createTaskFromAssistant } from '@/lib/actions/assistant'
import { cn } from '@/lib/utils'

const ICONS: Record<string, any> = { HeartHandshake, Flame, Coffee, Briefcase, Target, Apple }

const ACCENT: Record<string, { text: string; bg: string; border: string; solid: string; ring: string }> = {
    violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', solid: 'bg-violet-600', ring: 'focus:ring-violet-500/50' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', solid: 'bg-amber-600', ring: 'focus:ring-amber-500/50' },
    sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', solid: 'bg-sky-600', ring: 'focus:ring-sky-500/50' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', solid: 'bg-emerald-600', ring: 'focus:ring-emerald-500/50' },
    indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', solid: 'bg-indigo-600', ring: 'focus:ring-indigo-500/50' },
    lime: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30', solid: 'bg-lime-600', ring: 'focus:ring-lime-500/50' }
}

export interface ChatMessage {
    id: string
    role: string
    content: string
    persona?: string | null
}

interface AssistantChatProps {
    sessionId?: string | null
    persona: PersonaId
    initialMessages?: ChatMessage[]
    onPersonaChange: (p: PersonaId) => void
    onSessionCreated?: (sessionId: string) => void
    /** Mensaje inyectado desde afuera (ej: el briefing diario). Se agrega al hilo. */
    injectedMessage?: ChatMessage | null
    /** Oculta el selector de personas (cuando ya está arriba en la página). */
    hidePersonaPicker?: boolean
    className?: string
}

export function AssistantChat({
    sessionId,
    persona,
    initialMessages = [],
    onPersonaChange,
    onSessionCreated,
    injectedMessage = null,
    hidePersonaPicker = false,
    className
}: AssistantChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [savedTasks, setSavedTasks] = useState<Set<string>>(new Set())
    const endRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const p = getPersona(persona)
    const accent = ACCENT[p.accent] || ACCENT.indigo

    useEffect(() => {
        setMessages(initialMessages)
    }, [sessionId])

    useEffect(() => {
        if (!injectedMessage) return
        setMessages(prev => (prev.some(m => m.id === injectedMessage.id) ? prev : [...prev, injectedMessage]))
    }, [injectedMessage?.id])

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    async function handleSend(preset?: string) {
        const text = (preset ?? input).trim()
        if (!text || loading) return

        setMessages(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }])
        if (!preset) setInput('')
        setLoading(true)

        try {
            const res = await sendAssistantMessage({ sessionId, persona, message: text })
            setMessages(prev => [...prev, { id: `local-${Date.now()}-a`, role: 'assistant', content: res.reply, persona }])
            if (!sessionId && res.sessionId) onSessionCreated?.(res.sessionId)
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'assistant',
                content: `No pude responder: ${err?.message || 'error desconocido'}. Reintentá en unos segundos.`
            }])
        } finally {
            setLoading(false)
            inputRef.current?.focus()
        }
    }

    async function handleMakeTask(content: string) {
        const firstLine = content.split('\n').find(l => l.trim().length > 10)?.replace(/^[-*\d.\s]+/, '').trim()
        const title = (firstLine || content).slice(0, 120)
        try {
            await createTaskFromAssistant(title)
            setSavedTasks(prev => new Set(prev).add(content))
        } catch (e: any) {
            alert(`No se pudo crear la tarea: ${e?.message}`)
        }
    }

    return (
        <div className={cn('flex flex-col h-full min-h-0', className)}>
            {/* Selector de personalidad */}
            {!hidePersonaPicker && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-2 border-b border-border/50 shrink-0">
                    {PERSONA_LIST.map(item => {
                        const Icon = ICONS[item.icon] || Sparkles
                        const a = ACCENT[item.accent] || ACCENT.indigo
                        const active = item.id === persona
                        return (
                            <button
                                key={item.id}
                                onClick={() => onPersonaChange(item.id)}
                                title={item.tagline}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all',
                                    active
                                        ? `${a.bg} ${a.text} ${a.border}`
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {item.label}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                    <div className="text-center py-6 space-y-3">
                        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mx-auto', accent.bg, accent.text)}>
                            {(() => { const Icon = ICONS[p.icon] || Sparkles; return <Icon className="w-6 h-6" /> })()}
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">{p.label}</h4>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">{p.tagline}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-2">
                                Ya tengo tus tareas, hábitos, finanzas, comidas, entrenamientos y journal a la vista.
                            </p>
                        </div>

                        <div className="pt-2 space-y-1.5 max-w-md mx-auto">
                            {p.openers.map((op, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(op)}
                                    className={cn(
                                        'w-full text-left p-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-foreground/80 transition-all hover:bg-secondary hover:text-foreground',
                                        accent.border
                                    )}
                                >
                                    {op}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map(msg => {
                        const isUser = msg.role === 'user'
                        const msgPersona = getPersona(msg.persona || persona)
                        const msgAccent = ACCENT[msgPersona.accent] || ACCENT.indigo
                        const Icon = ICONS[msgPersona.icon] || Sparkles

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
                            >
                                {!isUser && (
                                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', msgAccent.bg, msgAccent.text)}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                )}

                                <div className="max-w-[82%] space-y-1.5">
                                    <div className={cn(
                                        'rounded-2xl p-3.5 text-xs leading-relaxed',
                                        isUser
                                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                                            : 'bg-secondary/80 border border-border/60 text-foreground rounded-tl-none'
                                    )}>
                                        {isUser ? (
                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                        ) : (
                                            <div className="prose prose-invert prose-xs max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {!isUser && msg.content.length > 40 && (
                                        <button
                                            onClick={() => handleMakeTask(msg.content)}
                                            disabled={savedTasks.has(msg.content)}
                                            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:text-emerald-400"
                                        >
                                            {savedTasks.has(msg.content)
                                                ? <><CheckCircle2 className="w-3 h-3" /> Tarea creada</>
                                                : <><Plus className="w-3 h-3" /> Convertir en tarea</>}
                                        </button>
                                    )}
                                </div>

                                {isUser && (
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <User className="w-4 h-4" />
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {loading && (
                    <div className="flex gap-2.5">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', accent.bg, accent.text)}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="bg-secondary/80 border border-border/60 rounded-2xl rounded-tl-none p-3.5 text-xs text-muted-foreground">
                            Leyendo tu Segundo Cerebro…
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-secondary/20 shrink-0">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={e => {
                            setInput(e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        disabled={loading}
                        placeholder={`Contale algo a tu ${p.label.toLowerCase()}…`}
                        className={cn(
                            'flex-1 bg-secondary/60 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 resize-none transition-all',
                            accent.ring
                        )}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        className={cn(
                            'p-2.5 text-white rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center disabled:opacity-40',
                            accent.solid
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-1">
                    Enter para enviar · Shift+Enter para salto de línea
                </p>
            </div>
        </div>
    )
}
