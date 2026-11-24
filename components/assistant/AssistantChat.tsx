'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Plus, Check, Loader2, Mic, MicOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { PERSONA_LIST, getPersona, type PersonaId } from '@/lib/assistantPersonas'
import { sendAssistantMessage, createTaskFromAssistant } from '@/lib/actions/assistant'
import { cn } from '@/lib/utils'

export interface ChatMessage { id: string; role: string; content: string; persona?: string | null }

interface Props {
    sessionId?: string | null
    persona: PersonaId
    initialMessages?: ChatMessage[]
    onPersonaChange: (p: PersonaId) => void
    onSessionCreated?: (sessionId: string) => void
    /** Avisa cada cambio del hilo, para que el padre lo conserve si el chat se desmonta. */
    onMessagesChange?: (messages: ChatMessage[]) => void
    /** Mensaje inyectado desde afuera (el briefing diario). */
    injectedMessage?: ChatMessage | null
    hidePersonaPicker?: boolean
    className?: string
}

/**
 * Conversación como texto, sin globos para el copiloto. Escucha el evento
 * `sc:assistant-ask` para que los atajos de la página manden una pregunta.
 */
export function AssistantChat({ sessionId, persona, initialMessages = [], onPersonaChange, onSessionCreated, onMessagesChange, injectedMessage = null, hidePersonaPicker, className }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [savedTasks, setSavedTasks] = useState<Set<string>>(new Set())
    const [listening, setListening] = useState(false)
    const [canDictate, setCanDictate] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const rec = useRef<any>(null)
    const p = getPersona(persona)

    useEffect(() => { setCanDictate(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); return () => rec.current?.stop?.() }, [])
    useEffect(() => {
        if (injectedMessage) setMessages(prev => prev.some(m => m.id === injectedMessage.id) ? prev : [...prev, injectedMessage])
    }, [injectedMessage?.id]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { onMessagesChange?.(messages) }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps
    // Se scrollea solo la lista, no la página entera.
    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, loading])

    async function send(preset?: string) {
        const text = (preset ?? input).trim()
        if (!text || loading) return
        rec.current?.stop?.()
        setMessages(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }])
        if (!preset) setInput('')
        setLoading(true)
        try {
            const res = await sendAssistantMessage({ sessionId, persona, message: text })
            setMessages(prev => [...prev, { id: `local-${Date.now()}-a`, role: 'assistant', content: res.reply, persona }])
            if (!sessionId && res.sessionId) onSessionCreated?.(res.sessionId)
        } catch (err: any) {
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `No pude responder: ${err?.message || 'error desconocido'}. Reintentá en unos segundos.` }])
        } finally {
            setLoading(false)
            inputRef.current?.focus()
        }
    }
    const sendRef = useRef(send)
    sendRef.current = send
    useEffect(() => {
        const ask = (e: Event) => sendRef.current(String((e as CustomEvent).detail || ''))
        window.addEventListener('sc:assistant-ask', ask)
        return () => window.removeEventListener('sc:assistant-ask', ask)
    }, [])

    function dictate() {
        if (listening) return rec.current?.stop()
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const r = new SR()
        r.lang = 'es-AR'
        r.interimResults = true
        const base = input ? `${input.trim()} ` : ''
        r.onresult = (ev: any) => setInput(base + Array.from(ev.results as any[]).map((x: any) => x[0].transcript).join(''))
        r.onend = r.onerror = () => setListening(false)
        rec.current = r
        setListening(true)
        r.start()
    }
    async function makeTask(id: string, content: string) {
        const line = content.split('\n').find(l => l.trim().length > 10)?.replace(/^[-*\d.\s]+/, '').replace(/\*\*/g, '').trim()
        try { await createTaskFromAssistant((line || content).slice(0, 120)); setSavedTasks(prev => new Set(prev).add(id)) } catch (e: any) { alert(`No se pudo crear la tarea: ${e?.message}`) }
    }

    return (
        <div className={cn('flex flex-col h-full min-h-0', className)}>
            {!hidePersonaPicker && (
                <div className="flex gap-1 overflow-x-auto no-scrollbar py-2 border-b border-hairline shrink-0">
                    {PERSONA_LIST.map(i => <button key={i.id} onClick={() => onPersonaChange(i.id)} title={i.tagline} aria-pressed={i.id === persona} className={cn('h-9 px-3 rounded-lg text-xs whitespace-nowrap', i.id === persona ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground')}>{i.label}</button>)}
                </div>
            )}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-6 px-1 space-y-7">
                {messages.length === 0 && (
                    <div>
                        <p className="label-caps">{p.label}</p>
                        <p className="text-xl font-semibold mt-1 max-w-[30ch]">{p.tagline}</p>
                        <p className="text-sm text-muted-foreground mt-2 max-w-[55ch]">Ya tengo a la vista tus tareas, hábitos, plata, comidas, entrenamientos y journal.</p>
                        <div className="mt-6 divide-y divide-hairline border-y border-hairline">{p.openers.map(o => <button key={o} onClick={() => send(o)} className="w-full text-left text-sm py-3 text-muted-foreground hover:text-foreground">{o}</button>)}</div>
                    </div>
                )}
                {messages.map(m => m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end"><p className="max-w-[80%] rounded-2xl rounded-br-md bg-raised border border-hairline px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p></div>
                ) : (
                    <div key={m.id}>
                        <p className="label-caps !text-[10px] mb-2">{getPersona((m.persona || persona) as PersonaId).label}</p>
                        <div className="prose-note text-[15px] leading-relaxed max-w-[65ch]"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                        {m.content.length > 40 && !m.id.startsWith('err') && <button onClick={() => makeTask(m.id, m.content)} disabled={savedTasks.has(m.id)} className="mt-2 min-h-[36px] text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:text-emerald-300">{savedTasks.has(m.id) ? <><Check className="w-3.5 h-3.5" /> Tarea creada</> : <><Plus className="w-3.5 h-3.5" /> Convertir en tarea</>}</button>}
                    </div>
                ))}
                {loading && <p role="status" className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Leyendo tu Segundo Cerebro…</p>}
            </div>
            <div className="shrink-0 pb-1">
                <div className="rounded-2xl bg-raised border border-hairline focus-within:ring-2 focus-within:ring-amber-400/50 p-2">
                    <textarea ref={inputRef} rows={1} value={input} disabled={loading} aria-label="Mensaje" placeholder="Escribí o dictá lo que tengas en la cabeza…"
                        onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px` }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        className="w-full bg-transparent resize-none px-2 py-2 text-[15px] focus:outline-none placeholder:text-ink-faint" />
                    <div className="flex items-center gap-2">
                        {canDictate && <button onClick={dictate} aria-label={listening ? 'Dejar de dictar' : 'Dictar'} className={cn('w-10 h-10 rounded-xl flex items-center justify-center', listening ? 'text-red-300' : 'text-muted-foreground hover:text-foreground')}>{listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>}
                        <span className="hidden sm:block font-mono text-[10px] text-ink-faint">Enter envía · Shift Enter baja de línea</span>
                        <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="Enviar" className="ml-auto w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"><ArrowUp className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    )
}
