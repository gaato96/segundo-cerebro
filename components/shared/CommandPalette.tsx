'use client'

import { useState, useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
    Search, Loader2, Brain, CheckSquare, Utensils, Target, Calendar, Heart, Tv, BookOpen,
    Moon, Inbox, Receipt, Plus, MessageCircleHeart, Sparkles, NotebookPen, Lightbulb,
    Focus, ArrowLeft, CornerDownLeft
} from 'lucide-react'
import { globalSearch, askBrain, type SearchResult, type BrainAnswer } from '@/lib/actions/search'
import { NAV_GROUPS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/**
 * Command palette (Ctrl/Cmd + K): ir a cualquier lado, hacer algo, buscar en
 * todo, o preguntarle al cerebro ("¿qué decidí sobre Vivomenú?").
 */

const TYPE_META: Record<SearchResult['type'], { label: string; icon: any }> = {
    task: { label: 'Tarea', icon: CheckSquare },
    note: { label: 'Captura', icon: Brain },
    recipe: { label: 'Receta', icon: Utensils },
    objective: { label: 'Objetivo', icon: Target },
    event: { label: 'Evento', icon: Calendar },
    wishlist: { label: 'Deseo', icon: Heart },
    media: { label: 'Media', icon: Tv },
    journal: { label: 'Journal', icon: BookOpen },
    knowledge: { label: 'Nota', icon: NotebookPen },
    idea: { label: 'Idea', icon: Lightbulb }
}

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.label })))

export function CommandPalette() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const [asking, setAsking] = useState(false)
    const [answer, setAnswer] = useState<BrainAnswer | null>(null)
    const [askError, setAskError] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
                e.preventDefault()
                setOpen(v => !v)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        const onRequest = () => setOpen(true)
        window.addEventListener('keydown', onKey)
        window.addEventListener('sc:palette', onRequest)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('sc:palette', onRequest)
        }
    }, [])

    useEffect(() => {
        if (!open) {
            setQuery('')
            setAnswer(null)
            setAskError('')
        }
    }, [open])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setAnswer(null)
        setAskError('')
        if (query.trim().length < 2) {
            setResults([])
            setSearching(false)
            return
        }
        setSearching(true)
        debounceRef.current = setTimeout(async () => {
            try {
                setResults(await globalSearch(query))
            } catch {
                setResults([])
            } finally {
                setSearching(false)
            }
        }, 220)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query])

    function go(url: string) {
        setOpen(false)
        router.push(url)
    }

    function fire(event: string, detail?: unknown) {
        setOpen(false)
        setTimeout(() => window.dispatchEvent(new CustomEvent(event, { detail })), 60)
    }

    async function ask() {
        setAsking(true)
        setAskError('')
        const res = await askBrain(query)
        setAsking(false)
        if (!res.ok) return setAskError(res.error)
        setAnswer(res.data)
    }

    const q = query.trim().toLowerCase()
    const looksLikeQuestion = q.length >= 4

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] px-3" role="dialog" aria-label="Buscar o hacer algo">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                        className="relative w-full max-w-[640px]"
                    >
                        <Command shouldFilter={false} loop className="bg-card border border-hairline rounded-2xl shadow-2xl overflow-hidden">
                            <div className="flex items-center gap-3 px-4 border-b border-hairline">
                                {searching || asking
                                    ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                                    : <Search className="w-4 h-4 text-amber-400 shrink-0" />}
                                <Command.Input
                                    autoFocus
                                    value={query}
                                    onValueChange={setQuery}
                                    placeholder="Buscar, preguntar o ir a…"
                                    className="flex-1 bg-transparent h-14 text-[15px] text-foreground placeholder:text-ink-faint focus:outline-none"
                                />
                                <kbd className="kbd">Esc</kbd>
                            </div>

                            {answer || askError ? (
                                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                                    <button onClick={() => { setAnswer(null); setAskError('') }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a los resultados
                                    </button>
                                    {askError ? (
                                        <p className="text-sm text-red-300">{askError}</p>
                                    ) : answer && (
                                        <>
                                            <div className="flex gap-3">
                                                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                                                <p className="text-[15px] leading-relaxed max-w-[60ch]">{answer.answer}</p>
                                            </div>
                                            {answer.sources.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="label-caps !text-[10px]">De dónde lo saqué</p>
                                                    {answer.sources.map((s, i) => {
                                                        const meta = TYPE_META[s.type]
                                                        return (
                                                            <button key={`${s.type}-${s.id}`} onClick={() => go(s.url)} className="w-full flex items-center gap-3 h-10 px-2 rounded-lg hover:bg-raised text-left text-sm">
                                                                <span className="font-mono text-[10px] text-ink-faint w-5">[{i + 1}]</span>
                                                                <meta.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <span className="flex-1 truncate">{s.title}</span>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{meta.label}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : (
                                <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                                    {looksLikeQuestion && (
                                        <Command.Group heading={<GroupTitle>Preguntar</GroupTitle>}>
                                            <Item
                                                icon={Sparkles}
                                                accent
                                                label={`Preguntarle al cerebro: “${query.trim()}”`}
                                                hint="IA sobre tus notas"
                                                onSelect={ask}
                                            />
                                        </Command.Group>
                                    )}

                                    {q.length < 2 && (
                                        <Command.Group heading={<GroupTitle>Acciones</GroupTitle>}>
                                            <Item icon={Brain} label="Capturar" hint="C" onSelect={() => fire('sc:quick-capture')} />
                                            <Item icon={CheckSquare} label="Crear tarea" hint="lenguaje natural" onSelect={() => fire('sc:quick-capture', { kind: 'task' })} />
                                            <Item icon={Receipt} label="Registrar gasto" hint="Ctrl Shift L" onSelect={() => fire('sc:quick-expense', { kind: 'expense' })} />
                                            <Item icon={NotebookPen} label="Nueva nota" onSelect={() => go('/notas?new=1')} />
                                            <Item icon={Focus} label="Entrar en modo foco" onSelect={() => go('/foco')} />
                                            <Item icon={Inbox} label="Vaciar el Inbox" onSelect={() => go('/inbox')} />
                                            <Item icon={Moon} label="Cerrar el día" onSelect={() => go('/cierre')} />
                                            <Item icon={MessageCircleHeart} label="Hablar con el Copiloto" hint="Ctrl J" onSelect={() => fire('sc:assistant')} />
                                        </Command.Group>
                                    )}

                                    {q.length >= 2 && (
                                        <Command.Group heading={<GroupTitle>Acciones</GroupTitle>}>
                                            <Item icon={Plus} label={`Crear tarea “${query.trim()}”`} onSelect={() => fire('sc:quick-capture', { kind: 'task', text: query.trim() })} />
                                            <Item icon={Brain} label={`Anotar en el Inbox “${query.trim()}”`} onSelect={() => fire('sc:quick-capture', { text: query.trim() })} />
                                        </Command.Group>
                                    )}

                                    {results.length > 0 && (
                                        <Command.Group heading={<GroupTitle>Resultados</GroupTitle>}>
                                            {results.map(r => {
                                                const meta = TYPE_META[r.type]
                                                return (
                                                    <Item
                                                        key={`${r.type}-${r.id}`}
                                                        icon={meta.icon}
                                                        label={r.title}
                                                        badge={meta.label}
                                                        hint={r.subtitle}
                                                        onSelect={() => go(r.url)}
                                                    />
                                                )
                                            })}
                                        </Command.Group>
                                    )}

                                    <Command.Group heading={<GroupTitle>Ir a</GroupTitle>}>
                                        {NAV_ITEMS
                                            .filter(n => !q || `${n.label} ${n.group}`.toLowerCase().includes(q))
                                            .slice(0, q ? 6 : NAV_ITEMS.length)
                                            .map(n => (
                                                <Item key={n.href} icon={n.icon} label={n.label} hint={n.group} onSelect={() => go(n.href)} />
                                            ))}
                                    </Command.Group>

                                    <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                                        Nada que coincida.
                                    </Command.Empty>
                                </Command.List>
                            )}

                            <div className="hidden sm:flex items-center gap-4 px-4 h-10 border-t border-hairline font-mono text-[10px] text-ink-faint">
                                <span>↑↓ moverte</span>
                                <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> ejecutar</span>
                                <span className="ml-auto">{results.length ? `${results.length} resultados` : ''}</span>
                            </div>
                        </Command>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function GroupTitle({ children }: { children: React.ReactNode }) {
    return <span className="label-caps !text-[10px] px-2 pt-2 pb-1 block">{children}</span>
}

function Item({ icon: Icon, label, badge, hint, onSelect, accent }: {
    icon: any; label: string; badge?: string; hint?: string; onSelect: () => void; accent?: boolean
}) {
    return (
        <Command.Item
            value={`${label} ${badge || ''} ${hint || ''}`}
            onSelect={onSelect}
            className={cn(
                'flex items-center gap-3 px-2.5 h-10 rounded-lg cursor-pointer text-sm text-foreground',
                'data-[selected=true]:bg-raised'
            )}
        >
            <Icon className={cn('w-4 h-4 shrink-0', accent ? 'text-amber-400' : 'text-muted-foreground')} />
            <span className="flex-1 truncate">{label}</span>
            {badge && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{badge}</span>}
            {hint && <span className="font-mono text-[10px] text-ink-faint shrink-0 truncate max-w-[140px]">{hint}</span>}
        </Command.Item>
    )
}
