'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Brain, LayoutDashboard, CheckSquare, Flame,
    DollarSign, Baby, Tv, Target, BookOpen,
    Heart, LogOut, ChevronLeft, ChevronRight,
    Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/tasks', icon: CheckSquare, label: 'Tareas' },
    { href: '/habits', icon: Flame, label: 'Hábitos' },
    { href: '/finances', icon: DollarSign, label: 'Finanzas' },
    { href: '/julian', icon: Baby, label: 'Julian' },
    { href: '/media', icon: Tv, label: 'Entretenimiento' },
    { href: '/okrs', icon: Target, label: 'Objetivos' },
    { href: '/journal', icon: BookOpen, label: 'Journal' },
    { href: '/wishlist', icon: Heart, label: 'Wishlist' },
]

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
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative',
                                collapsed && 'justify-center',
                                isActive
                                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
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
                            {/* Tooltip when collapsed */}
                            {collapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    )
                })}
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
