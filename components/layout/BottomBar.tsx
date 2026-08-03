'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    LayoutDashboard, CheckSquare, Flame, DollarSign,
    Baby, Tv, Target, BookOpen, Heart, Utensils,
    Inbox, Sun, CalendarRange, Calendar, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

const bottomNavItems = [
    { href: '/', icon: LayoutDashboard, label: 'Inicio' },
    { href: '/ritual', icon: Sun, label: 'Ritual' },
    { href: '/planner', icon: CalendarRange, label: 'Planner' },
    { href: '/calendar', icon: Calendar, label: 'Calendario' },
    { href: '/inbox', icon: Inbox, label: 'Inbox' },
    { href: '/tasks', icon: CheckSquare, label: 'Tareas' },
    { href: '/habits', icon: Flame, label: 'Hábitos' },
    { href: '/meals/nutrition', icon: Sparkles, label: 'Nutrición' },
    { href: '/meals', icon: Utensils, label: 'Comidas' },
    { href: '/finances', icon: DollarSign, label: 'Finanzas' },
    { href: '/julian', icon: Baby, label: 'Julián' },
    { href: '/okrs', icon: Target, label: 'OKRs' },
    { href: '/journal', icon: BookOpen, label: 'Journal' },
    { href: '/media', icon: Tv, label: 'Media' },
    { href: '/wishlist', icon: Heart, label: 'Deseos' },
]

export function BottomBar() {
    const pathname = usePathname()

    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="glass border-t border-border/50 backdrop-blur-xl">
                {/* Horizontal scroll container with hidden scrollbar */}
                <div className="flex items-center px-2 py-2 overflow-x-auto gap-1 no-scrollbar snap-x snap-mandatory">
                    {bottomNavItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/' && pathname.startsWith(item.href))

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] snap-center flex-shrink-0"
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
                                    'text-[9px] font-medium relative z-10 transition-colors whitespace-nowrap',
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
