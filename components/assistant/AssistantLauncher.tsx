'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircleHeart, X, Maximize2, Loader2, Sun, Plus } from 'lucide-react'
import Link from 'next/link'
import { AssistantChat, type ChatMessage } from './AssistantChat'
import { getDailyBriefing, getSessionMessages } from '@/lib/actions/assistant'
import type { PersonaId } from '@/lib/assistantPersonas'

const STORAGE_KEY = 'sc_assistant_persona'
const SESSION_KEY = 'sc_assistant_session'

/**
 * Botón flotante del Copiloto: está disponible en todas las páginas.
 * Atajo de teclado: Ctrl/Cmd + J.
 */
export function AssistantLauncher() {
    const [open, setOpen] = useState(false)
    const [persona, setPersona] = useState<PersonaId>('terapeuta')
    const [sessionId, setSessionId] = useState<string | null>(null)
    // El hilo vive acá y no en el chat: el panel se desmonta al cerrarse y
    // antes cada vez que se volvía a abrir la charla aparecía vacía.
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [chatKey, setChatKey] = useState(0)
    const [restoring, setRestoring] = useState(false)
    const [restored, setRestored] = useState(false)
    const [briefing, setBriefing] = useState<ChatMessage | null>(null)
    const [briefingLoading, setBriefingLoading] = useState(false)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as PersonaId | null
            if (saved) setPersona(saved)
        } catch { /* sin storage */ }
    }, [])

    // Al abrir por primera vez (o después de recargar), se retoma la última charla.
    useEffect(() => {
        if (!open || restored) return
        setRestored(true)
        let savedSession: string | null = null
        try { savedSession = localStorage.getItem(SESSION_KEY) } catch { /* sin storage */ }
        if (!savedSession || sessionId) return

        setRestoring(true)
        getSessionMessages(savedSession)
            .then((msgs: any[]) => {
                if (!msgs?.length) return
                setSessionId(savedSession)
                setMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content, persona: m.persona })))
                const last = [...msgs].reverse().find(m => m.persona)?.persona as PersonaId | undefined
                if (last) setPersona(last)
                setChatKey(k => k + 1)
            })
            .catch(() => {
                try { localStorage.removeItem(SESSION_KEY) } catch { /* sin storage */ }
            })
            .finally(() => setRestoring(false))
    }, [open, restored, sessionId])

    function handleSessionCreated(id: string) {
        setSessionId(id)
        try { localStorage.setItem(SESSION_KEY, id) } catch { /* sin storage */ }
    }

    function newChat() {
        setSessionId(null)
        setMessages([])
        setBriefing(null)
        setChatKey(k => k + 1)
        try { localStorage.removeItem(SESSION_KEY) } catch { /* sin storage */ }
    }

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
                e.preventDefault()
                setOpen(v => !v)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    function changePersona(p: PersonaId) {
        setPersona(p)
        try { localStorage.setItem(STORAGE_KEY, p) } catch { /* sin storage */ }
    }

    async function handleBriefing() {
        setBriefingLoading(true)
        try {
            const text = await getDailyBriefing(persona)
            setBriefing({ id: `brief-${Date.now()}`, role: 'assistant', content: text, persona })
        } catch (e: any) {
            setBriefing({ id: `brief-err-${Date.now()}`, role: 'assistant', content: `No pude armar el briefing: ${e?.message}` })
        } finally {
            setBriefingLoading(false)
        }
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpen(true)}
                title="Copiloto personal (Ctrl+J)"
                className="fixed bottom-[148px] md:bottom-24 right-5 z-40 bg-violet-600 text-white p-3.5 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.45)] hover:bg-violet-500 transition-colors flex items-center justify-center"
            >
                <MessageCircleHeart className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <div className="fixed inset-0 z-[60] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                            className="relative w-full sm:max-w-md h-full bg-background border-l border-border shadow-2xl flex flex-col"
                        >
                            <div className="p-3.5 border-b border-border flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                                        <MessageCircleHeart className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-heading font-bold text-foreground leading-tight">Copiloto</h3>
                                        <p className="text-[10px] text-muted-foreground">Te conoce por tus datos, no por lo que le contás</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={newChat}
                                        title="Nueva charla"
                                        className="p-2 text-muted-foreground hover:text-violet-400 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleBriefing}
                                        disabled={briefingLoading}
                                        title="Briefing de hoy"
                                        className="p-2 text-muted-foreground hover:text-amber-400 transition-colors"
                                    >
                                        {briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />}
                                    </button>
                                    <Link
                                        href={sessionId ? `/asistente?sesion=${sessionId}` : '/asistente'}
                                        onClick={() => setOpen(false)}
                                        title="Abrir pantalla completa"
                                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {restoring ? (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Retomando la última charla…
                                </div>
                            ) : (
                                <AssistantChat
                                    key={chatKey}
                                    sessionId={sessionId}
                                    persona={persona}
                                    initialMessages={messages}
                                    injectedMessage={briefing}
                                    onPersonaChange={changePersona}
                                    onSessionCreated={handleSessionCreated}
                                    onMessagesChange={setMessages}
                                    className="flex-1 min-h-0"
                                />
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
