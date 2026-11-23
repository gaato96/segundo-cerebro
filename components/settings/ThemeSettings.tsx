'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'graphite' | 'paper' | 'auto'

const OPTIONS: { id: Theme; label: string; hint: string; icon: any; swatch: string[] }[] = [
    { id: 'graphite', label: 'Graphite', hint: 'Oscuro. Para la mañana temprano y la noche.', icon: Moon, swatch: ['#111113', '#18181B', '#E0A54B'] },
    { id: 'paper', label: 'Paper', hint: 'Claro, papel cálido. Para el sol.', icon: Sun, swatch: ['#F7F5F0', '#FFFFFF', '#B7791F'] },
    { id: 'auto', label: 'Automático', hint: 'Sigue al sistema del dispositivo.', icon: Monitor, swatch: ['#111113', '#F7F5F0', '#E0A54B'] }
]

export function applyTheme(t: Theme) {
    const paper = t === 'paper' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches)
    const root = document.documentElement
    if (paper) { root.setAttribute('data-theme', 'paper'); root.classList.remove('dark') }
    else { root.removeAttribute('data-theme'); root.classList.add('dark') }
}

/** Tema de este dispositivo. Vive en el navegador (cada equipo elige el suyo). */
export function ThemeSettings() {
    const [theme, setTheme] = useState<Theme>('graphite')

    useEffect(() => {
        try { setTheme((localStorage.getItem('sc-theme') as Theme) || 'graphite') } catch { }
    }, [])

    useEffect(() => {
        if (theme !== 'auto') return
        const mq = window.matchMedia('(prefers-color-scheme: light)')
        const on = () => applyTheme('auto')
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [theme])

    function choose(t: Theme) {
        setTheme(t)
        try { localStorage.setItem('sc-theme', t) } catch { }
        applyTheme(t)
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Tema">
            {OPTIONS.map(o => (
                <button
                    key={o.id}
                    role="radio"
                    aria-checked={theme === o.id}
                    onClick={() => choose(o.id)}
                    className={cn('text-left rounded-2xl p-4 border transition-colors', theme === o.id ? 'lamp' : 'bg-card border-hairline hover:border-[hsl(var(--hairline-strong))]')}
                >
                    <div className="flex gap-1 mb-3">
                        {o.swatch.map(c => <span key={c} className="w-6 h-6 rounded-md border border-black/10" style={{ background: c }} />)}
                    </div>
                    <p className="text-sm font-medium flex items-center gap-2"><o.icon className="w-4 h-4" /> {o.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{o.hint}</p>
                </button>
            ))}
        </div>
    )
}
