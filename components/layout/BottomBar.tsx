'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    LayoutDashboard, CheckSquare, Flame, DollarSign,
    Baby, Tv, Target, BookOpen, Heart, Utensils, Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'

const bottomNavItems = [
    { href: '/', icon: LayoutDashboard, label: 'Inicio' },
    { href: '/inbox', icon: Inbox, label: 'Inbox' },
    { href: '/tasks', icon: CheckSquare, label: 'Tareas' },
    { href: '/habits', icon: Flame, label: 'Hábitos' },
    { href: '/finances', icon: DollarSign, label: 'Finanzas' },
    { href: '/julian', icon: Baby, label: 'Julián' },
    { href: '/media', icon: Tv, label: 'Media' },
    { href: '/okrs', icon: Target, label: 'OKRs' },
    { href: '/journal', icon: BookOpen, label: 'Journal' },
    { href: '/wishlist', icon: Heart, label: 'Deseos' },
    { href: '/meals', icon: Utensils, label: 'Comidas' },
]

export function BottomBar() {
    const pathname = usePathname()

    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe">
            <div className="glass border-t border-border/50 backdrop-blur-xl">
                {/* Horizontal scroll container with hidden scrollbar */}
                <div className="flex items-center px-4 py-2 overflow-x-auto gap-2 no-scrollbar snap-x">
                    {bottomNavItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/' && pathname.startsWith(item.href))

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all min-w-[72px] snap-center"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="bottom-active"
                                        className="absolute inset-0 bg-indigo-600/20 rounded-xl border border-indigo-500/20"
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                                <item.icon className={cn(
                                    'w-5 h-5 relative z-10 transition-colors',
                                    isActive ? 'text-indigo-400' : 'text-muted-foreground'
                                )} />
                                <span className={cn(
                                    'text-[10px] font-medium relative z-10 transition-colors whitespace-nowrap',
                                    isActive ? 'text-indigo-400' : 'text-muted-foreground'
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}

