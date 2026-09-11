'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Plus, Trash2, UserCog, MessagesSquare,
    Loader2, Sun, Database, ChevronLeft
} from 'lucide-react'
import { AssistantChat, type ChatMessage } from '@/components/assistant/AssistantChat'
import { ContextProfileForm } from '@/components/assistant/ContextProfileForm'
import { PERSONA_LIST, getPersona, type PersonaId } from '@/lib/assistantPersonas'
import {
    getSessionMessages, deleteAssistantSession, getDailyBriefing, previewBrainSnapshot
} from '@/lib/actions/assistant'
import { cn } from '@/lib/utils'

interface Props {
    initialSessions: any[]
    initialContext: any
}

type Tab = 'chat' | 'perfil' | 'contexto'

export function AsistentePageClient({ initialSessions, initialContext }: Props) {
    const [sessions, setSessions] = useState<any[]>(initialSessions)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [persona, setPersona] = useState<PersonaId>('terapeuta')
    const [tab, setTab] = useState<Tab>('chat')
    const [loadingSession, setLoadingSession] = useState(false)
    const [briefing, setBriefing] = useState<ChatMessage | null>(null)
    const [briefingLoading, setBriefingLoading] = useState(false)
    const [snapshot, setSnapshot] = useState<string>('')
    const [snapshotLoading, setSnapshotLoading] = useState(false)
    const [showSidebar, setShowSidebar] = useState(false)

    async function openSession(s: any) {
        setLoadingSession(true)
        setShowSidebar(false)
        try {
            const msgs = await getSessionMessages(s.id)
            setSessionId(s.id)
            setPersona(s.persona)
            setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, persona: m.persona })))
            setTab('chat')
        } finally {
            setLoadingSession(false)
        }
    }

    function newSession(p?: PersonaId) {
        setSessionId(null)
        setMessages([])
        setBriefing(null)
        if (p) setPersona(p)
        setTab('chat')
        setShowSidebar(false)
    }

    async function removeSession(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        if (!confirm('¿Borrar esta conversación? No se puede deshacer.')) return
        await deleteAssistantSession(id)
        setSessions(prev => prev.filter(s => s.id !== id))
        if (sessionId === id) newSession()
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

    async function loadSnapshot() {
        setSnapshotLoading(true)
        try {
            setSnapshot(await previewBrainSnapshot())
        } catch (e: any) {
            setSnapshot(`Error: ${e?.message}`)
        } finally {
            setSnapshotLoading(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Copiloto</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Terapeuta, coach, amigo, socio. El mismo que ya conoce toda tu vida cargada acá.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleBriefing}
                        disabled={briefingLoading}
                        className="px-3.5 py-2 glass hover:bg-secondary/60 border border-amber-500/30 text-xs font-semibold text-amber-300 rounded-xl transition-all flex items-center gap-1.5"
                    >
                        {briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />}
                        Briefing de hoy
                    </button>
                    <button
                        onClick={() => newSession()}
                        className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva charla
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1 bg-secondary/50 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
                {[
                    { id: 'chat', label: 'Conversación', icon: MessagesSquare },
                    { id: 'perfil', label: 'Sobre mí', icon: UserCog },
                    { id: 'contexto', label: 'Qué está viendo', icon: Database }
                ].map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id as Tab); if (t.id === 'contexto' && !snapshot) loadSnapshot() }}
                            className={cn(
                                'flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-1 min-w-[130px]',
                                active ? 'bg-violet-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                    {/* Lista de conversaciones */}
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowSidebar(v => !v)}
                            className="lg:hidden w-full px-3 py-2 glass border border-border/50 rounded-xl text-xs font-semibold text-foreground flex items-center justify-between"
                        >
                            <span>Conversaciones ({sessions.length})</span>
                            <ChevronLeft className={cn('w-4 h-4 transition-transform', showSidebar && '-rotate-90')} />
                        </button>

                        <div className={cn('space-y-3', !showSidebar && 'hidden lg:block')}>
                            <div className="glass rounded-2xl border border-border/50 p-2 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 block">
                                    Empezar como…
                                </span>
                                {PERSONA_LIST.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => newSession(p.id)}
                                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors"
                                    >
                                        <span className="text-xs font-semibold text-foreground block">{p.label}</span>
                                        <span className="text-[10px] text-muted-foreground block leading-tight">{p.tagline}</span>
                                    </button>
                                ))}
                            </div>

                            {sessions.length > 0 && (
                                <div className="glass rounded-2xl border border-border/50 p-2 space-y-1 max-h-[340px] overflow-y-auto">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 block">
                                        Historial
                                    </span>
                                    {sessions.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => openSession(s)}
                                            className={cn(
                                                'group px-2.5 py-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2',
                                                sessionId === s.id ? 'bg-violet-500/15 border border-violet-500/30' : 'hover:bg-secondary/60'
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <span className="text-xs font-medium text-foreground block truncate">{s.title}</span>
                                                <span className="text-[10px] text-muted-foreground">{getPersona(s.persona).label}</span>
                                            </div>
                                            <button
                                                onClick={e => removeSession(s.id, e)}
                                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0 p-1"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass rounded-2xl border border-violet-500/20 shadow-xl h-[70vh] min-h-[520px] flex flex-col overflow-hidden"
                    >
                        {loadingSession ? (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando conversación…
                            </div>
                        ) : (
                            <AssistantChat
                                key={sessionId || 'new'}
                                sessionId={sessionId}
                                persona={persona}
                                initialMessages={messages}
                                injectedMessage={briefing}
                                onPersonaChange={setPersona}
                                onSessionCreated={id => {
                                    setSessionId(id)
                                    setSessions(prev => [
                                        { id, persona, title: 'Nueva conversación', last_message_at: new Date().toISOString() },
                                        ...prev
                                    ])
                                }}
                                className="flex-1 min-h-0"
                            />
                        )}
                    </motion.div>
                </div>
            )}

            {tab === 'perfil' && (
                <div className="max-w-2xl">
                    <ContextProfileForm initial={initialContext} />
                </div>
            )}

            {tab === 'contexto' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Esto es exactamente lo que el asistente lee de tu Segundo Cerebro antes de cada respuesta.
                            Nada sale de tu cuenta salvo este texto, que se manda al modelo para responderte.
                        </p>
                        <button
                            onClick={loadSnapshot}
                            disabled={snapshotLoading}
                            className="px-3 py-1.5 glass border border-border/50 rounded-lg text-xs font-semibold text-foreground shrink-0 flex items-center gap-1.5"
                        >
                            {snapshotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            Actualizar
                        </button>
                    </div>
                    <pre className="glass rounded-2xl border border-border/50 p-4 text-[11px] text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto font-mono leading-relaxed">
                        {snapshotLoading && !snapshot ? 'Leyendo tu Segundo Cerebro…' : snapshot || 'Tocá "Actualizar" para verlo.'}
                    </pre>
                </div>
            )}
        </div>
    )
}
