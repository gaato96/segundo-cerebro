'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MODULE_TABS, type ModuleKey } from '@/lib/navigation'

/** Pestañas de los módulos fusionados (Nutrición, Agenda). Va en las acciones de la cabecera. */
export function ModuleTabs({ module, className }: { module: ModuleKey; className?: string }) {
    const pathname = usePathname()
    return (
        <div className={cn('inline-flex max-w-full overflow-x-auto no-scrollbar p-1 rounded-xl bg-card border border-hairline gap-1', className)}>
            {MODULE_TABS[module].tabs.map(tab => {
                const active = pathname === tab.href
                return (
                    <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}
                        className={cn('h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors', active ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        <tab.icon className="w-4 h-4" />{tab.label}
                    </Link>
                )
            })}
        </div>
    )
}
