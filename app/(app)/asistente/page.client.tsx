'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Plus, Sun, Trash2 } from 'lucide-react'
import { AssistantChat, type ChatMessage } from '@/components/assistant/AssistantChat'
import { ContextProfileForm } from '@/components/assistant/ContextProfileForm'
import { getPersona, type PersonaId } from '@/lib/assistantPersonas'
import { getSessionMessages, deleteAssistantSession, getDailyBriefing, previewBrainSnapshot } from '@/lib/actions/assistant'
import type { TodayData } from '@/lib/actions/today'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'
import { Segmented } from '@/components/ui/controls'
import { formatCurrency, cn } from '@/lib/utils'

const ASKS = ['¿Qué hago ahora?', 'Armame la semana', '¿Cómo vengo con mis objetivos?', '¿Qué estoy postergando?']

export function AsistentePageClient({ initialSessions, initialContext, today }: { initialSessions: any[]; initialContext: any; today: TodayData | null }) {
    const [sessions, setSessions] = useState(initialSessions)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [persona, setPersona] = useState<PersonaId>('terapeuta')
    const [tab, setTab] = useState<'chat' | 'perfil' | 'contexto'>('chat')
    const [loading, setLoading] = useState(false)
    const [briefing, setBriefing] = useState<ChatMessage | null>(null)
    const [briefingLoading, setBriefingLoading] = useState(false)
    const [snapshot, setSnapshot] = useState('')
    // Cambia solo al abrir otra charla: remontar con el primer mensaje borraba la conversación.
    const [chatKey, setChatKey] = useState(0)

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('sesion')
        if (id) open(initialSessions.find(s => s.id === id) || { id, persona: 'terapeuta' }).catch(() => { })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function open(s: any) {
        setLoading(true)
        setTab('chat')
        try {
            const msgs = await getSessionMessages(s.id)
            setSessionId(s.id)
            setPersona(s.persona)
            setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, persona: m.persona })))
            setBriefing(null)
            setChatKey(k => k + 1)
        } finally { setLoading(false) }
    }
    function fresh() {
        setSessionId(null)
        setMessages([])
        setBriefing(null)
        setChatKey(k => k + 1)
        setTab('chat')
    }
    async function remove(id: string) {
        if (!confirm('¿Borrar esta conversación? No se puede deshacer.')) return
        await deleteAssistantSession(id)
        setSessions(p => p.filter(s => s.id !== id))
        if (sessionId === id) fresh()
    }
    async function brief() {
        setBriefingLoading(true)
        setTab('chat')
        try { setBriefing({ id: `brief-${Date.now()}`, role: 'assistant', content: await getDailyBriefing(persona), persona }) }
        catch (e: any) { setBriefing({ id: `err-${Date.now()}`, role: 'assistant', content: `No pude armar el briefing: ${e?.message}` }) }
        finally { setBriefingLoading(false) }
    }
    async function loadSnapshot() {
        setSnapshot('Leyendo…')
        try { setSnapshot(await previewBrainSnapshot()) } catch (e: any) { setSnapshot(`Error: ${e?.message}`) }
    }

    const overdue = today?.otherTasks.filter((t: any) => t.due_date && String(t.due_date).slice(0, 10) < today.today).length ?? 0
    const done = today?.focusTasks.filter((t: any) => t.status === 'Done').length ?? 0

    return (
        <PageShell wide>
            <PageHeader label="Hoy · asistencia" title="Copiloto" subtitle="Pensá en voz alta, despejá dudas y convertí la respuesta en una tarea."
                actions={<><button onClick={brief} disabled={briefingLoading} className="btn-secondary text-sm">{briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />} Briefing</button><button onClick={fresh} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Nueva charla</button></>} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 min-w-0">
                    <Segmented value={tab} onChange={v => { setTab(v); if (v === 'contexto' && !snapshot) loadSnapshot() }} options={[{ id: 'chat', label: 'Conversación' }, { id: 'perfil', label: 'Sobre mí' }, { id: 'contexto', label: 'Qué está viendo' }]} />
                    <div className={cn('h-[calc(100dvh-330px)] min-h-[460px] max-w-[760px]', tab !== 'chat' && 'hidden')}>
                        {loading ? <p className="py-10 text-sm text-muted-foreground flex gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo la charla…</p> : <AssistantChat key={chatKey} sessionId={sessionId} persona={persona} initialMessages={messages} injectedMessage={briefing} onPersonaChange={setPersona} onMessagesChange={setMessages} onSessionCreated={id => { setSessionId(id); setSessions(p => [{ id, persona, title: 'Nueva conversación' }, ...p]) }} />}
                    </div>
                    {tab === 'perfil' && <div className="max-w-[760px] mt-6"><ContextProfileForm initial={initialContext} /></div>}
                    {tab === 'contexto' && <div className="mt-6"><p className="text-sm text-muted-foreground max-w-[65ch] mb-3">Esto es lo que lee de tu sistema antes de cada respuesta. Se manda al modelo de IA para poder contestarte. <button onClick={loadSnapshot} className="underline underline-offset-4">Actualizar</button></p><pre className="rounded-2xl bg-card border border-hairline p-5 text-xs whitespace-pre-wrap max-h-[65vh] overflow-y-auto font-mono leading-relaxed">{snapshot}</pre></div>}
                </div>
                <aside className="lg:col-span-4 min-w-0 space-y-4">
                    {today && <Panel>
                        <SectionLabel>Lo que sabe hoy</SectionLabel>
                        <dl className="divide-y divide-hairline text-sm">
                            <div className="py-2.5"><dt className="text-muted-foreground flex justify-between">Foco <span className="font-mono">{today.planned ? `${done}/${today.focusTasks.length}` : 'sin plan'}</span></dt><dd className="mt-0.5">{today.planned ? today.focus || today.focusTasks[0]?.title : <Link href="/ritual" className="underline underline-offset-4">Planificar el día</Link>}</dd></div>
                            {([['Tareas vencidas', overdue, overdue > 0], ['Hábitos', `${today.habits.filter((h: any) => h.done_today).length}/${today.habits.length}`, false], ['Inbox', today.inbox.count, false], ['Eventos de hoy', today.events.length, false], ['Balance del mes', formatCurrency(today.money.balance), today.money.balance < 0]] as [string, React.ReactNode, boolean][]).map(([l, v, bad]) => <div key={l} className="flex justify-between py-2.5"><dt className="text-muted-foreground">{l}</dt><dd className={cn('font-mono', bad && 'text-red-300')}>{v}</dd></div>)}
                        </dl>
                    </Panel>}
                    <div className="divide-y divide-hairline border-y border-hairline">{ASKS.map(q => <button key={q} onClick={() => { setTab('chat'); window.dispatchEvent(new CustomEvent('sc:assistant-ask', { detail: q })) }} className="w-full min-h-[48px] flex items-center justify-between text-sm text-muted-foreground hover:text-foreground">{q}<ArrowRight className="w-4 h-4" /></button>)}</div>
                    {sessions.length > 0 && <Panel><SectionLabel right={sessions.length}>Charlas</SectionLabel><div className="-mx-2 max-h-[300px] overflow-y-auto">{sessions.map(s => <div key={s.id} className={cn('flex items-center rounded-lg', sessionId === s.id && 'bg-raised')}><button onClick={() => open(s)} className="flex-1 min-w-0 text-left px-2 py-2"><span className="block text-sm truncate">{s.title}</span><span className="text-xs text-muted-foreground">{getPersona(s.persona).label}</span></button><button onClick={() => remove(s.id)} aria-label="Borrar charla" className="w-10 h-10 text-ink-faint hover:text-red-300 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button></div>)}</div></Panel>}
                </aside>
            </div>
        </PageShell>
    )
}
