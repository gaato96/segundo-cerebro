'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen, Lamp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, ALL_HREFS, isNavActive } from '@/lib/navigation'
import { useInboxCount } from '@/lib/useInboxCount'
import { NavLink } from '@/components/layout/NavLink'

/**
 * Riel izquierdo de 240px (design system): grupos con etiqueta chica en
 * mayúsculas, ítem activo con barra ámbar de 2px a la izquierda.
 */
export function Sidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const inbox = useInboxCount()

    useEffect(() => {
        try { setCollapsed(localStorage.getItem('sc-sidebar') === 'collapsed') } catch { }
    }, [])

    function toggle() {
        setCollapsed(v => {
            try { localStorage.setItem('sc-sidebar', v ? 'open' : 'collapsed') } catch { }
            return !v
        })
    }

    async function signOut() {
        await createClient().auth.signOut()
        window.location.href = '/login'
    }

    return (
        <aside
            className={cn(
                'hidden md:flex flex-col h-[100dvh] bg-sidebar border-r border-sidebar-border sticky top-0 z-40 shrink-0 transition-[width] duration-300',
                collapsed ? 'w-[68px]' : 'w-[240px]'
            )}
        >
            <div className={cn('flex items-center gap-3 h-16 px-4 border-b border-sidebar-border', collapsed && 'justify-center px-0')}>
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/25 flex items-center justify-center shrink-0">
                    <Lamp className="w-4 h-4 text-amber-400" />
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">Segundo Cerebro</p>
                        <p className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">sistema personal</p>
                    </div>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
                {NAV_GROUPS.map(group => (
                    <div key={group.label}>
                        {!collapsed && <p className="label-caps px-3 pb-1.5 !text-[10px]">{group.label}</p>}
                        <div className="space-y-0.5">
                            {group.items.map(item => {
                                const active = isNavActive(pathname, item.href, ALL_HREFS)
                                const badge = item.href === '/inbox' && inbox > 0 ? inbox : null
                                return (
                                    <NavLink
                                        key={item.href}
                                        href={item.href}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            'relative flex items-center gap-3 h-9 rounded-lg text-[13px] transition-colors',
                                            collapsed ? 'justify-center' : 'px-3',
                                            active
                                                ? 'bg-sidebar-accent text-foreground font-medium'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
                                        )}
                                    >
                                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-amber-400" />}
                                        <item.icon className={cn('w-4 h-4 shrink-0', active && 'text-amber-400')} />
                                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                                        {badge && !collapsed && (
                                            <span className="font-mono text-[10px] px-1.5 rounded-md bg-raised border border-hairline text-muted-foreground">{badge}</span>
                                        )}
                                        {badge && collapsed && <span className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                                    </NavLink>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className={cn('border-t border-sidebar-border p-2 flex gap-1', collapsed ? 'flex-col items-center' : 'items-center')}>
                <button
                    onClick={signOut}
                    title="Salir"
                    className={cn('flex items-center gap-3 h-9 rounded-lg text-[13px] text-muted-foreground hover:text-red-400 hover:bg-sidebar-accent/60 transition-colors', collapsed ? 'w-9 justify-center' : 'flex-1 px-3')}
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {!collapsed && 'Salir'}
                </button>
                <button
                    onClick={toggle}
                    title={collapsed ? 'Expandir' : 'Colapsar'}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                >
                    {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    )
}
