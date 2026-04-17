'use client'

import { useState, useEffect } from 'react'
import { Trophy, Check, Loader2 } from 'lucide-react'
import { saveDailyWin } from '@/lib/actions/daily_wins'
import confetti from 'canvas-confetti'

interface DailyWinWidgetProps {
    initialWin: string | null
    dateStr: string
}

export function DailyWinWidget({ initialWin, dateStr }: DailyWinWidgetProps) {
    const [win, setWin] = useState(initialWin || '')
    const [isSaved, setIsSaved] = useState(!!initialWin)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setWin(initialWin || '')
        setIsSaved(!!initialWin)
    }, [initialWin])

    async function handleSave() {
        if (!win.trim() || isSaved) return
        setLoading(true)

        try {
            await saveDailyWin(win, dateStr)

            // Dopamine hit
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#fbbf24', '#f59e0b', '#d97706']
            })

            setIsSaved(true)
        } catch (error) {
            console.error('Failed to save daily win:', error)
            alert('Error al guardar tu victoria.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass rounded-2xl p-6 border border-yellow-500/30 shadow-lg bg-gradient-to-br from-background to-yellow-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full" />

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-xl">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                    <h3 className="font-heading font-semibold text-lg">Victoria del Día</h3>
                    <p className="text-xs text-muted-foreground">Solo una cosa que salió bien. El progreso real suma.</p>
                </div>
            </div>

            {isSaved ? (
                <div className="relative group">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                        <div className="bg-yellow-500 rounded-full p-1 text-white shrink-0">
                            <Check className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{win}</p>
                    </div>
                    {/* Allow editing on hover if they want to change it */}
                    <button
                        onClick={() => setIsSaved(false)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-background/80 hover:bg-background px-2 py-1 rounded-md text-muted-foreground"
                    >
                        Editar
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={win}
                        onChange={(e) => setWin(e.target.value)}
                        placeholder="Ej: Envié 3 propuestas, Jugué 20min con mi hijo..."
                        className="flex-1 bg-background border border-border focus:border-yellow-500/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all placeholder:text-muted-foreground"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave()
                        }}
                    />
                    <button
                        onClick={handleSave}
                        disabled={loading || !win.trim()}
                        className="bg-yellow-500 hover:bg-yellow-600 active:scale-95 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center min-w-[80px]"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                    </button>
                </div>
            )}
        </div>
    )
}
