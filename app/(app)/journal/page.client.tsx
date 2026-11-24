'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, PenLine } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MoodIcon } from '@/components/ui/MoodIcon'
import { getJournalEntry, saveJournalEntry, getJournalMonth } from '@/lib/actions/journal'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'
import { addDaysToDateStr, getLocalDateStr, cn } from '@/lib/utils'

type Month = Awaited<ReturnType<typeof getJournalMonth>>
const MOODS = ['Agotado', 'Regular', 'Neutral', 'Bien', 'Excelente']
const PROMPTS = ['¿Qué aprendiste hoy?', '¿Dónde hubo fricción o desgaste?', '¿Una victoria que merezca registro?']
const tone = (m: number | null) => (!m ? 'bg-graphite-400' : m >= 4 ? 'bg-emerald-400' : m === 3 ? 'bg-sky-400' : 'bg-red-400')
const count = (t: string) => t.split(/\s+/).filter(Boolean).length

export function JournalClient() {
    const today = getLocalDateStr()
    const [date, setDate] = useState(today)
    const [month, setMonth] = useState(today.slice(0, 7))
    const [content, setContent] = useState('')
    const [mood, setMood] = useState<number | undefined>()
    const [editing, setEditing] = useState(true)
    const [loading, setLoading] = useState(true)
    const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [data, setData] = useState<Month | null>(null)
    const pending = useRef<{ date: string; content: string; mood?: number } | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const area = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        let alive = true
        setLoading(true)
        getJournalEntry(date).then(e => {
            if (!alive) return
            setContent(e?.content || '')
            setMood(e?.mood || undefined)
            setEditing(!e?.content)
            setLoading(false)
        }).catch(() => alive && setState('error'))
        return () => { alive = false }
    }, [date])
    useEffect(() => {
        let alive = true
        getJournalMonth(month, date).then(d => alive && setData(d)).catch(() => { })
        return () => { alive = false }
    }, [month, date])
    useEffect(() => {
        const el = area.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.max(el.scrollHeight, 360)}px`
    }, [content, editing, loading])
    // Al salir de la pantalla se guarda lo que quedó pendiente.
    useEffect(() => () => { void flush() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function flush() {
        if (timer.current) clearTimeout(timer.current)
        const p = pending.current
        if (!p) return true
        pending.current = null
        try {
            await saveJournalEntry(p.date, p.content, p.mood)
            setState('saved')
            setData(d => d && ({
                ...d,
                entries: [...d.entries.filter(e => e.date !== p.date), { date: p.date, mood: p.mood ?? null, words: count(p.content) }],
                dates: d.dates.includes(p.date) ? d.dates : [p.date, ...d.dates]
            }))
            return true
        } catch {
            pending.current = pending.current || p
            setState('error')
            return false
        }
    }
    function change(next: { content?: string; mood?: number }) {
        const c = next.content ?? content, m = next.mood ?? mood
        if (next.content !== undefined) setContent(c)
        if (next.mood !== undefined) setMood(m)
        pending.current = { date, content: c, mood: m }
        setState('saving')
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(flush, 1200)
    }
    async function go(d: string) {
        if (d > today || d === date) return
        if (!(await flush())) return
        setLoading(true)
        setDate(d)
        setMonth(d.slice(0, 7))
        setState('idle')
    }
    function moveMonth(n: number) {
        const [yy, mm] = month.split('-').map(Number)
        const d = new Date(yy, mm - 1 + n, 1)
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (next <= today.slice(0, 7)) setMonth(next)
    }

    const [y, m] = month.split('-').map(Number)
    const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
    const byDate = new Map((data?.entries || []).map(e => [e.date, e]))
    const withMood = (data?.entries || []).filter(e => e.mood)
    const good = withMood.filter(e => e.mood! >= 4).length, mid = withMood.filter(e => e.mood === 3).length, bad = withMood.length - good - mid
    const dates = new Set(data?.dates || [])
    let streak = 0
    for (let d = dates.has(today) ? today : addDaysToDateStr(today, -1); dates.has(d); d = addDaysToDateStr(d, -1)) streak++

    return (
        <PageShell wide>
            <PageHeader label="Capturar · reflexión" title="Journal" subtitle="Un espacio sobrio para vaciar la cabeza, registrar aprendizajes y notar patrones."
                actions={<span role="status" className={cn('font-mono text-xs flex items-center gap-2', state === 'error' ? 'text-red-300' : 'text-muted-foreground')}><span className={cn('w-1.5 h-1.5 rounded-full', state === 'error' ? 'bg-red-400' : state === 'saving' ? 'bg-amber-400' : 'bg-emerald-400')} />{state === 'saving' ? 'Guardando…' : state === 'error' ? 'Error al guardar o cargar' : 'Guardado automático'}</span>} />

            <Panel className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => moveMonth(-1)} aria-label="Mes anterior" className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-medium capitalize">{format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: es })}</span>
                    <button onClick={() => moveMonth(1)} aria-label="Mes siguiente" disabled={month >= today.slice(0, 7)} className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                    <span className="ml-auto hidden sm:flex gap-4 text-xs text-muted-foreground">{[['bg-emerald-400', 'Bueno'], ['bg-sky-400', 'Neutral'], ['bg-red-400', 'Difícil']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={cn('w-1.5 h-1.5 rounded-full', c)} />{l}</span>)}</span>
                </div>
                <div className="grid grid-cols-7 lg:flex gap-1">
                    {days.map(d => {
                        const e = byDate.get(d), sel = d === date
                        return (
                            <button key={d} onClick={() => go(d)} disabled={d > today} aria-label={d} aria-current={sel ? 'date' : undefined}
                                className={cn('flex-1 min-w-0 h-12 rounded-lg flex flex-col items-center justify-center gap-1 font-mono text-xs border transition-colors disabled:opacity-25', sel ? 'lamp text-amber-300' : 'border-transparent text-muted-foreground hover:bg-raised')}>
                                {Number(d.slice(8))}<span className={cn('w-1.5 h-1.5 rounded-full', e ? tone(e.mood) : 'bg-transparent')} />
                            </button>
                        )
                    })}
                </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <article className="lg:col-span-8 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{format(new Date(`${date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}</p>
                        <button onClick={() => setEditing(v => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 min-h-[36px]">{editing ? <><Eye className="w-4 h-4" /> Leer</> : <><PenLine className="w-4 h-4" /> Escribir</>}</button>
                    </div>
                    {loading ? <div className="space-y-3 animate-pulse">{[90, 100, 80, 60].map(w => <div key={w} className="h-4 rounded bg-raised" style={{ width: `${w}%` }} />)}</div> : editing ? (
                        <>
                            <textarea ref={area} value={content} onChange={e => change({ content: e.target.value })} placeholder="Escribí lo que tengas en la cabeza…" aria-label="Entrada del día" className="w-full max-w-[65ch] min-h-[360px] bg-transparent resize-none text-[17px] leading-[1.75] focus:outline-none placeholder:text-ink-faint" />
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-hairline">
                                {PROMPTS.map(p => <button key={p} onClick={() => { change({ content: `${content.trim()}${content.trim() ? '\n\n' : ''}## ${p}\n\n` }); area.current?.focus() }} className="h-9 px-3 rounded-lg border border-hairline text-xs text-muted-foreground hover:text-foreground">{p}</button>)}
                            </div>
                        </>
                    ) : <div className="prose-note max-w-[65ch] text-[17px] leading-[1.75]" onDoubleClick={() => setEditing(true)}>{content ? <ReactMarkdown>{content}</ReactMarkdown> : <p className="text-muted-foreground">Sin entrada este día.</p>}</div>}
                    <p className="font-mono text-[11px] text-ink-faint mt-4">{count(content)} palabras</p>
                </article>

                <aside className="lg:col-span-4 space-y-4">
                    <Panel>
                        <SectionLabel>¿Cómo te sentís?</SectionLabel>
                        <div className="grid grid-cols-5 gap-1.5">
                            {MOODS.map((l, i) => <button key={l} disabled={loading} onClick={() => change({ mood: i + 1 })} aria-pressed={mood === i + 1} title={l} className={cn('h-14 rounded-xl border flex items-center justify-center', mood === i + 1 ? 'lamp text-amber-300' : 'border-hairline text-muted-foreground hover:text-foreground')}><MoodIcon value={i + 1} /></button>)}
                        </div>
                        {mood && <p className="text-xs text-muted-foreground mt-2">{MOODS[mood - 1]}</p>}
                    </Panel>
                    <Panel>
                        <SectionLabel right={`${data?.entries.length ?? 0} de ${days.length} días`}>El mes</SectionLabel>
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-raised gap-px">{([['bg-emerald-400', good], ['bg-sky-400', mid], ['bg-red-400', bad]] as [string, number][]).map(([c, n]) => <span key={c} className={c} style={{ width: `${withMood.length ? (n / withMood.length) * 100 : 0}%` }} />)}</div>
                        <p className="text-xs text-muted-foreground mt-2">{withMood.length ? `${good} buenos · ${mid} neutrales · ${bad} difíciles` : 'Todavía sin ánimo registrado este mes.'}</p>
                        <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-hairline"><span className="text-sm text-muted-foreground">Racha de escritura</span><span className="font-mono text-xl">{streak} <span className="text-xs text-muted-foreground">días</span></span></div>
                    </Panel>
                    {!!data?.memories.length && <Panel><SectionLabel>Este día, otros años</SectionLabel>{data.memories.map(x => <button key={x.date} onClick={() => go(x.date)} className="block w-full text-left py-2"><span className="font-mono text-xs text-muted-foreground">{x.date.slice(0, 4)}</span><span className="block text-sm line-clamp-3 mt-1">{x.content}</span></button>)}</Panel>}
                </aside>
            </div>
        </PageShell>
    )
}
