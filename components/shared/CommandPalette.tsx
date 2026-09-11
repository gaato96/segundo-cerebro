'use client'

import { useState, useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
    Search, Loader2, Brain, CheckSquare, Utensils, Target, Calendar,
    Heart, Tv, BookOpen, LayoutDashboard, Sun, Moon, CalendarRange,
    Inbox, Flame, DollarSign, Baby, Sparkles, Dumbbell, MessageCircleHeart,
    Bell, Plus, LineChart
} from 'lucide-react'
import { globalSearch, type SearchResult } from '@/lib/actions/search'
import { cn } from '@/lib/utils'

/**
 * Command palette (Ctrl/Cmd + K).
 *
 * cmdk ya estaba instalado en el proyecto y sin usar. Con 15 módulos, navegar
 * por la sidebar es el cuello de botella real.
 */

const NAV_ITEMS = [
    { label: 'Dashboard', url: '/', icon: LayoutDashboard, keywords: 'inicio home resumen' },
    { label: 'Copiloto', url: '/asistente', icon: MessageCircleHeart, keywords: 'asistente terapeuta coach amigo chat' },
    { label: 'Ritual matutino', url: '/ritual', icon: Sun, keywords: 'mañana manana objetivo' },
    { label: 'Cierre del día', url: '/cierre', icon: Moon, keywords: 'noche ritual nocturno victoria' },
    { label: 'Revisión semanal', url: '/cierre?tab=semana', icon: CalendarRange, keywords: 'semana review domingo' },
    { label: 'Planificador', url: '/planner', icon: CalendarRange, keywords: 'planner semana' },
    { label: 'Calendario', url: '/calendar', icon: Calendar, keywords: 'eventos agenda' },
    { label: 'Inbox', url: '/inbox', icon: Inbox, keywords: 'capturas vaciado mental' },
    { label: 'Tareas', url: '/tasks', icon: CheckSquare, keywords: 'todo pendientes' },
    { label: 'Hábitos', url: '/habits', icon: Flame, keywords: 'habitos rachas' },
    { label: 'Entrenamiento', url: '/entrenamiento', icon: Dumbbell, keywords: 'gimnasio rutina soga plan' },
    { label: 'Nutricionista IA', url: '/meals/nutrition', icon: Sparkles, keywords: 'dieta calorias peso' },
    { label: 'Comidas', url: '/meals', icon: Utensils, keywords: 'recetas menu' },
    { label: 'Finanzas', url: '/finances', icon: DollarSign, keywords: 'plata gastos ingresos deudas' },
    { label: 'Indicadores', url: '/insights', icon: LineChart, keywords: 'correlaciones patrones datos animo' },
    { label: 'Julián', url: '/julian', icon: Baby, keywords: 'hijo salud vacunas' },
    { label: 'Objetivos', url: '/okrs', icon: Target, keywords: 'okr metas sueños' },
    { label: 'Journal', url: '/journal', icon: BookOpen, keywords: 'diario animo' },
    { label: 'Entretenimiento', url: '/media', icon: Tv, keywords: 'peliculas series juegos libros' },
    { label: 'Wishlist', url: '/wishlist', icon: Heart, keywords: 'deseos comprar' },
    { label: 'Ajustes', url: '/ajustes', icon: Bell, keywords: 'notificaciones configuracion push' }
]

const TYPE_META: Record<SearchResult['type'], { label: string; icon: any }> = {
    task: { label: 'Tarea', icon: CheckSquare },
    note: { label: 'Captura', icon: Brain },
    recipe: { label: 'Receta', icon: Utensils },
    objective: { label: 'Objetivo', icon: Target },
    event: { label: 'Evento', icon: Calendar },
    wishlist: { label: 'Deseo', icon: Heart },
    media: { label: 'Media', icon: Tv },
    journal: { label: 'Journal', icon: BookOpen }
}

export function CommandPalette() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
                e.preventDefault()
                setOpen(v => !v)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
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
        setQuery('')
        router.push(url)
    }

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -8 }}
                        className="relative w-full max-w-xl"
                    >
                        <Command
                            shouldFilter={false}
                            loop
                            className="bg-secondary/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center gap-2 px-4 border-b border-border">
                                {searching
                                    ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                                    : <Search className="w-4 h-4 text-muted-foreground shrink-0" />}
                                <Command.Input
                                    autoFocus
                                    value={query}
                                    onValueChange={setQuery}
                                    placeholder="Buscar o ir a…"
                                    className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                                />
                                <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                                    esc
                                </kbd>
                            </div>

                            <Command.List className="max-h-[55vh] overflow-y-auto p-2">
                                <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                                    {query.trim().length < 2 ? 'Escribí para buscar' : 'Nada que coincida'}
                                </Command.Empty>

                                {/* Acciones rápidas */}
                                {query.trim().length < 2 && (
                                    <Command.Group heading={<GroupTitle>Acciones</GroupTitle>}>
                                        <Item
                                            icon={Brain}
                                            label="Vaciado mental"
                                            hint="Ctrl+Shift+K"
                                            onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent('sc:quick-capture')) }}
                                        />
                                        <Item icon={Plus} label="Nueva tarea" onSelect={() => go('/tasks')} />
                                        <Item icon={Moon} label="Cerrar el día" onSelect={() => go('/cierre')} />
                                        <Item icon={MessageCircleHeart} label="Hablar con el Copiloto" hint="Ctrl+J" onSelect={() => go('/asistente')} />
                                    </Command.Group>
                                )}

                                {/* Resultados */}
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

                                {/* Navegación */}
                                <Command.Group heading={<GroupTitle>Ir a</GroupTitle>}>
                                    {NAV_ITEMS
                                        .filter(n => {
                                            const q = query.trim().toLowerCase()
                                            if (!q) return true
                                            return `${n.label} ${n.keywords}`.toLowerCase().includes(q)
                                        })
                                        .slice(0, query.trim() ? 6 : NAV_ITEMS.length)
                                        .map(n => (
                                            <Item
                                                key={n.url}
                                                icon={n.icon}
                                                label={n.label}
                                                onSelect={() => go(n.url)}
                                            />
                                        ))}
                                </Command.Group>
                            </Command.List>
                        </Command>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function GroupTitle({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5 block">
            {children}
        </span>
    )
}

function Item({ icon: Icon, label, badge, hint, onSelect }: {
    icon: any; label: string; badge?: string; hint?: string; onSelect: () => void
}) {
    return (
        <Command.Item
            value={`${label} ${badge || ''} ${hint || ''}`}
            onSelect={onSelect}
            className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-foreground',
                'data-[selected=true]:bg-indigo-500/15 data-[selected=true]:text-indigo-200'
            )}
        >
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {badge && (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded shrink-0">
                    {badge}
                </span>
            )}
            {hint && <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[120px]">{hint}</span>}
        </Command.Item>
    )
}
