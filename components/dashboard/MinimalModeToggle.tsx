'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Feather, LayoutGrid, Loader2 } from 'lucide-react'
import { setMinimalMode } from '@/lib/actions/profile'
import { cn } from '@/lib/utils'

/**
 * Modo mínimo: lo único obligatorio del día es el compromiso y los hábitos.
 * Todo lo demás (ritual, victoria, notas, pomodoro, stats) queda opcional.
 */
export function MinimalModeToggle({ enabled, variant = 'chip' }: { enabled: boolean; variant?: 'chip' | 'card' }) {
    const router = useRouter()
    const [on, setOn] = useState(enabled)
    const [pending, startTransition] = useTransition()

    function toggle() {
        const next = !on
        setOn(next)
        startTransition(async () => {
            const res = await setMinimalMode(next)
            if ('error' in res && res.error) {
                setOn(!next)
                alert(res.error)
                return
            }
            router.refresh()
        })
    }

    if (variant === 'card') {
        return (
            <div className="glass p-5 rounded-2xl border border-border/50 flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-white flex items-center gap-2"><Feather className="w-4 h-4 text-teal-300" /> Modo mínimo</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        El dashboard muestra solo lo obligatorio: el compromiso del día, los hábitos y las tareas de hoy, más la captura al Inbox.
                        El ritual, la victoria del día, el pomodoro y las estadísticas quedan opcionales. Ideal para semanas cargadas o para volver después de desconectarte.
                    </p>
                </div>
                <button
                    onClick={toggle}
                    disabled={pending}
                    role="switch"
                    aria-checked={on}
                    className={cn('relative w-11 h-6 rounded-full transition shrink-0 mt-0.5', on ? 'bg-teal-500' : 'bg-secondary')}
                >
                    <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', on && 'translate-x-5')} />
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={toggle}
            disabled={pending}
            title={on ? 'Mostrar todo el dashboard' : 'Mostrar solo lo obligatorio'}
            className={cn(
                'px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border transition whitespace-nowrap',
                on ? 'bg-teal-500/10 text-teal-200 border-teal-500/30 hover:bg-teal-500/20' : 'bg-secondary/40 text-muted-foreground border-border/60 hover:text-white'
            )}
        >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? <Feather className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            {on ? 'Modo mínimo' : 'Vista completa'}
        </button>
    )
}
