'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, CalendarClock, ArrowRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { MonthForecast } from '@/lib/actions/forecast'

const STYLE = {
    verde: {
        border: 'border-emerald-500/30',
        bg: 'from-emerald-950/20',
        text: 'text-emerald-400',
        bar: 'bg-emerald-500',
        icon: CheckCircle2
    },
    amarillo: {
        border: 'border-amber-500/30',
        bg: 'from-amber-950/20',
        text: 'text-amber-400',
        bar: 'bg-amber-500',
        icon: AlertTriangle
    },
    rojo: {
        border: 'border-red-500/30',
        bg: 'from-red-950/20',
        text: 'text-red-400',
        bar: 'bg-red-500',
        icon: TrendingDown
    }
} as const

export function MonthForecastWidget({ forecast, compact = false }: { forecast: MonthForecast; compact?: boolean }) {
    const style = STYLE[forecast.status]
    const Icon = style.icon
    const progress = Math.round((forecast.daysElapsed / forecast.daysInMonth) * 100)

    return (
        <div className={cn(
            'glass p-5 rounded-2xl border bg-gradient-to-br to-secondary/20 space-y-4',
            style.border,
            style.bg
        )}>
            <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-xl border shrink-0', style.border, style.text, 'bg-background/30')}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Semáforo del mes
                    </span>
                    <h3 className={cn('text-sm font-heading font-bold leading-snug mt-0.5', style.text)}>
                        {forecast.headline}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{forecast.detail}</p>
                </div>
            </div>

            {/* Avance del mes */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Día {forecast.daysElapsed} de {forecast.daysInMonth}</span>
                    <span>{forecast.daysRemaining} días restantes</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                        className={cn('h-full', style.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Números */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Hoy" value={formatCurrency(forecast.balanceToday)} />
                <Metric label="Fijos por pagar" value={formatCurrency(forecast.upcomingFixed)} muted />
                <Metric
                    label="Proyección"
                    value={formatCurrency(forecast.projectedEndBalance)}
                    className={style.text}
                />
            </div>

            {forecast.daysRemaining > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background/40 border border-border/40">
                    <TrendingUp className={cn('w-3.5 h-3.5 shrink-0', style.text)} />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Podés gastar hasta{' '}
                        <strong className="text-foreground">{formatCurrency(forecast.safeDailySpend)} por día</strong>{' '}
                        sin quedar en rojo. Venís en {formatCurrency(forecast.dailyVariableRate)}.
                    </p>
                </div>
            )}

            {!compact && forecast.upcomingFixedItems.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pt-2">
                        <CalendarClock className="w-3 h-3" /> Lo que se viene
                    </span>
                    {forecast.upcomingFixedItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground truncate">
                                Día {item.dueDay} · {item.description}
                            </span>
                            <span className="text-foreground font-semibold shrink-0 ml-2">
                                {formatCurrency(item.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {compact && (
                <Link
                    href="/finances"
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                    Ver finanzas <ArrowRight className="w-3 h-3" />
                </Link>
            )}
        </div>
    )
}

function Metric({ label, value, muted, className }: {
    label: string; value: string; muted?: boolean; className?: string
}) {
    return (
        <div className="p-2 rounded-xl bg-background/30 border border-border/30">
            <span className={cn(
                'block text-xs font-bold leading-tight truncate',
                className || (muted ? 'text-muted-foreground' : 'text-foreground')
            )}>
                {value}
            </span>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
        </div>
    )
}
