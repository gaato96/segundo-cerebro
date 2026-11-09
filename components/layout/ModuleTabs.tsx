'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MODULE_TABS, type ModuleKey } from '@/lib/navigation'

/**
 * Pestañas de los módulos fusionados (Nutrición, Agenda).
 * Cada pestaña sigue siendo su propia ruta; esto las presenta como una sola cosa.
 */
export function ModuleTabs({ module, className }: { module: ModuleKey; className?: string }) {
    const pathname = usePathname()
    const group = MODULE_TABS[module]

    return (
        <div className={cn('px-4 md:px-6 pt-4 md:pt-6 max-w-6xl mx-auto', className)}>
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                <div className="inline-flex p-1 rounded-xl bg-secondary/40 border border-border/50 gap-1">
                    {group.tabs.map(tab => {
                        const active = pathname === tab.href
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={cn(
                                    'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition',
                                    active ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/30' : 'text-muted-foreground hover:text-white border border-transparent'
                                )}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
