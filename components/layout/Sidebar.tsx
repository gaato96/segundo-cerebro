'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Brain, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, ALL_HREFS, isNavActive } from '@/lib/navigation'

export function Sidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const supabase = createClient()

    async function signOut() {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <motion.aside
            animate={{ width: collapsed ? 72 : 240 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border sticky top-0 overflow-hidden z-40"
        >
            {/* Logo */}
            <div className={cn(
                'flex items-center gap-3 p-4 border-b border-sidebar-border',
                collapsed && 'justify-center'
            )}>
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-indigo-400" />
                </div>
                {!collapsed && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-heading font-bold text-sm gradient-text whitespace-nowrap"
                    >
                        Segundo Cerebro
                    </motion.span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 overflow-y-auto no-scrollbar">
                {NAV_GROUPS.map((group, gi) => (
                    <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
                        {collapsed
                            ? gi > 0 && <div className="mx-3 mb-2 border-t border-sidebar-border" />
                            : <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">{group.label}</p>}
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = isNavActive(pathname, item.href, ALL_HREFS)

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative',
                                            collapsed && 'justify-center',
                                            isActive
                                                ? 'text-indigo-300'
                                                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                                        )}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="sidebar-active"
                                                className="absolute inset-0 bg-indigo-600/20 rounded-xl border border-indigo-500/20"
                                                transition={{ duration: 0.2 }}
                                            />
                                        )}
                                        <item.icon className={cn(
                                            'w-4 h-4 flex-shrink-0 relative z-10',
                                            isActive ? 'text-indigo-400' : 'text-current'
                                        )} />
                                        {!collapsed && (
                                            <span className="text-sm font-medium relative z-10 whitespace-nowrap">{item.label}</span>
                                        )}
                                        {collapsed && (
                                            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                {item.label}
                                            </div>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="p-2 border-t border-sidebar-border space-y-1">
                <button
                    onClick={signOut}
                    className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-red-400/70 hover:text-red-400 hover:bg-red-500/10',
                        collapsed && 'justify-center'
                    )}
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm">Salir</span>}
                </button>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                        collapsed && 'justify-center'
                    )}
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-xs">Colapsar</span>
                        </>
                    )}
                </button>
            </div>
        </motion.aside>
    )
}
