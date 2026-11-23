import { cn } from '@/lib/utils'

/**
 * Piezas del design system "Graphite" (docs/stitch/DESIGN.md).
 * Patrón de cabecera: etiqueta chica (fecha o módulo) + título + una línea
 * en tinta apagada; la acción principal, a la derecha.
 */

export function PageShell({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
    return (
        <div className={cn('mx-auto w-full px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-12 animate-fade-in', wide ? 'max-w-[1280px]' : 'max-w-[1100px]', className)}>
            {children}
        </div>
    )
}

export function PageHeader({ label, title, subtitle, actions, className }: {
    label?: React.ReactNode
    title: React.ReactNode
    subtitle?: React.ReactNode
    actions?: React.ReactNode
    className?: string
}) {
    return (
        <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6 mb-6 border-b border-hairline', className)}>
            <div className="min-w-0">
                {label && <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{label}</p>}
                <h1 className="text-2xl md:text-[30px] font-semibold tracking-tight leading-tight">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-[65ch]">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </header>
    )
}

export function SectionLabel({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
            <h2 className="label-caps">{children}</h2>
            {right && <div className="text-xs text-muted-foreground font-mono">{right}</div>}
        </div>
    )
}

export function Panel({ children, className, lamp }: { children: React.ReactNode; className?: string; lamp?: boolean }) {
    return (
        <section className={cn('rounded-2xl p-4 md:p-5', lamp ? 'lamp' : 'bg-card border border-hairline', className)}>
            {children}
        </section>
    )
}

export function EmptyState({ icon: Icon, title, hint, action }: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    hint?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col items-center text-center py-10 px-6 rounded-2xl border border-dashed border-hairline">
            <Icon className="w-7 h-7 text-ink-faint mb-3" />
            <p className="text-sm font-medium">{title}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{hint}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}

export function Check({ done, accent, className }: { done: boolean; accent?: boolean; className?: string }) {
    return (
        <span className={cn(
            'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
            done ? 'bg-emerald-400 border-emerald-400 text-background' : accent ? 'border-amber-400/70' : 'border-[hsl(var(--hairline-strong))]',
            className
        )}>
            {done && (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.2 5 8.5l4.5-5" />
                </svg>
            )}
        </span>
    )
}
