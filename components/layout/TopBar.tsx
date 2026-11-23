'use client'

import { useEffect, useState } from 'react'
import { Search, Plus, Lamp } from 'lucide-react'
import { formatLocalDate } from '@/lib/utils'

function openPalette() {
    window.dispatchEvent(new CustomEvent('sc:palette'))
}

function openCapture() {
    window.dispatchEvent(new CustomEvent('sc:quick-capture'))
}

/**
 * Barra de comandos de escritorio (56px): buscar o hacer algo con ⌘K y el
 * botón ámbar de captura (tecla C).
 */
export function TopBar() {
    const [now, setNow] = useState<string>('')

    useEffect(() => {
        const tick = () => setNow(new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date()))
        tick()
        const id = setInterval(tick, 30_000)
        return () => clearInterval(id)
    }, [])

    return (
        <header className="hidden md:flex sticky top-0 z-30 h-14 items-center gap-3 px-6 bg-background/90 backdrop-blur border-b border-hairline">
            <button
                onClick={openPalette}
                className="flex items-center gap-2.5 h-9 w-full max-w-md px-3 rounded-xl bg-raised border border-hairline text-sm text-ink-faint hover:border-[hsl(var(--hairline-strong))] transition-colors"
            >
                <Search className="w-4 h-4" />
                <span className="flex-1 text-left">Buscar, preguntar o hacer algo…</span>
                <kbd className="kbd">Ctrl K</kbd>
            </button>

            <div className="ml-auto flex items-center gap-4">
                <span className="font-mono text-xs text-muted-foreground capitalize hidden lg:inline">
                    {formatLocalDate(new Date(), "EEE d MMM")} · {now}
                </span>
                <button onClick={openCapture} className="btn-primary !min-h-9 h-9 text-sm">
                    <Plus className="w-4 h-4" /> Capturar <kbd className="kbd !bg-black/15 !border-transparent !text-current">C</kbd>
                </button>
            </div>
        </header>
    )
}

/** Cabecera del celular: marca, fecha y el avatar que abre "Más". */
export function MobileHeader() {
    return (
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-background/90 backdrop-blur border-b border-hairline">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
                <Lamp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Segundo Cerebro</p>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{formatLocalDate(new Date(), "EEE d MMM")}</p>
            </div>
            <button
                onClick={openPalette}
                aria-label="Buscar"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
                <Search className="w-5 h-5" />
            </button>
            <button
                onClick={() => window.dispatchEvent(new CustomEvent('sc:more'))}
                aria-label="Más secciones"
                className="w-10 h-10 rounded-full bg-raised border border-hairline flex items-center justify-center text-xs font-semibold"
            >
                SC
            </button>
        </header>
    )
}
