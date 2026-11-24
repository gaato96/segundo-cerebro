'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Panel centrado en la compu, hoja desde abajo en el celular. */
export function Modal({ open = true, title, hint, onClose, children, wide }: {
    open?: boolean; title: string; hint?: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-label={title}>
            <div className="absolute inset-0 bg-[#000]/60" onClick={onClose} />
            <div className={cn('relative w-full max-h-[90dvh] overflow-y-auto bg-popover border border-hairline rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up', wide ? 'sm:max-w-[760px]' : 'sm:max-w-[560px]')}>
                <div className="sticky top-0 z-10 bg-popover flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="w-10 h-10 -mr-2 -mt-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-5 pb-6">{children}</div>
            </div>
        </div>
    )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <label className="block">
            <span className="label-caps block mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
        </label>
    )
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
    value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number | string; icon?: any }[]; className?: string
}) {
    return (
        <div className={cn('inline-flex max-w-full overflow-x-auto no-scrollbar gap-1 p-1 rounded-xl bg-card border border-hairline', className)} role="tablist">
            {options.map(o => (
                <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
                    className={cn('h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors shrink-0', value === o.id ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {o.icon && <o.icon className="w-4 h-4" />}{o.label}
                    {o.count !== undefined && <span className="font-mono text-[10px] text-muted-foreground">{o.count}</span>}
                </button>
            ))}
        </div>
    )
}

/** Tira de números separados por líneas finas (reemplaza las tarjetas KPI). */
export function StatStrip({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'good' | 'bad' }[] }) {
    return (
        <div className="grid grid-cols-2 lg:flex rounded-2xl bg-card border border-hairline lg:divide-x divide-hairline overflow-hidden">
            {items.map(i => (
                <div key={i.label} className="flex-1 min-w-0 px-4 md:px-5 py-4">
                    <p className="label-caps !text-[10px] truncate">{i.label}</p>
                    <p className={cn('font-mono text-xl md:text-2xl mt-1 truncate', i.tone === 'good' && 'text-emerald-300', i.tone === 'bad' && 'text-red-300')}>{i.value}</p>
                    {i.hint && <p className="text-xs text-muted-foreground mt-0.5">{i.hint}</p>}
                </div>
            ))}
        </div>
    )
}

export function Bar({ pct, tone = 'neutral', className }: { pct: number; tone?: 'amber' | 'good' | 'bad' | 'neutral' | 'blue'; className?: string }) {
    const c = { amber: 'bg-amber-400', good: 'bg-emerald-400', bad: 'bg-red-400', neutral: 'bg-graphite-300', blue: 'bg-sky-400' }[tone]
    return <span className={cn('block h-1 rounded-full bg-raised overflow-hidden', className)}><span className={cn('block h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} /></span>
}
