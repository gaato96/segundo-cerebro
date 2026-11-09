import Link from 'next/link'
import { Compass, LifeBuoy, ArrowRight, CalendarClock } from 'lucide-react'
import type { ReplanNudge as Nudge } from '@/lib/actions/quarterly'
import { cn } from '@/lib/utils'

/** Aviso del dashboard: volver después de desconectarte, o planificar el trimestre. */
export function ReplanNudge({ nudge }: { nudge: Nudge }) {
    const returning = nudge.kind === 'returning'
    const Icon = returning ? LifeBuoy : nudge.kind === 'checkin' ? CalendarClock : Compass

    return (
        <Link
            href="/replan"
            className={cn(
                'group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition-all',
                returning
                    ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
                    : 'bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/15'
            )}
        >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', returning ? 'bg-amber-500/15' : 'bg-teal-500/15')}>
                <Icon className={cn('w-5 h-5', returning ? 'text-amber-300' : 'text-teal-300')} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-bold text-white">{nudge.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nudge.body}</p>
            </div>
            <span className={cn(
                'shrink-0 self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5',
                returning ? 'bg-amber-500/20 text-amber-100' : 'bg-teal-500/20 text-teal-100'
            )}>
                {nudge.cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
        </Link>
    )
}
