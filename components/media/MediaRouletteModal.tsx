'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Dices, Play, RefreshCw, Clapperboard, Tv } from 'lucide-react'

export function MediaRouletteModal({
    items,
    onClose,
    onStartItem
}: {
    items: any[]
    onClose: () => void
    onStartItem: (id: string) => Promise<void>
}) {
    const [spinning, setSpinning] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedItem, setSelectedItem] = useState<any | null>(null)

    const startSpin = () => {
        if (items.length === 0) return
        setSpinning(true)
        setSelectedItem(null)

        let duration = 3000 // spin for 3 seconds
        let startTime = Date.now()
        let intervalTime = 50

        const tick = () => {
            const elapsed = Date.now() - startTime
            if (elapsed >= duration) {
                // Done spinning, pick final random item
                const finalIdx = Math.floor(Math.random() * items.length)
                setCurrentIndex(finalIdx)
                setSelectedItem(items[finalIdx])
                setSpinning(false)
            } else {
                // Shift to next item
                setCurrentIndex((prev) => (prev + 1) % items.length)
                // Slow down the interval as time goes on
                intervalTime = 50 + (elapsed / duration) * 300
                setTimeout(tick, intervalTime)
            }
        }

        setTimeout(tick, intervalTime)
    }

    useEffect(() => {
        // Automatically start spin when modal opens
        startSpin()
    }, [])

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-md flex flex-col rounded-3xl relative overflow-hidden shadow-2xl p-6 text-center space-y-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                    <h2 className="text-2xl font-heading font-bold flex items-center justify-center gap-2">
                        <Dices className="w-6 h-6 text-pink-500 animate-bounce" />
                        Ruleta del Backlog
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Dejemos que el destino elija qué ver hoy de tu lista de pendientes.
                    </p>
                </div>

                {/* Spinning display */}
                <div className="h-60 flex items-center justify-center border border-white/5 bg-black/30 rounded-2xl p-4 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b26]/50 via-transparent to-[#1a1b26]/50 pointer-events-none z-10" />
                    
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes películas ni series pendientes en tus filtros actuales.</p>
                    ) : (
                        <div className="w-full flex flex-col items-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: spinning ? 0.05 : 0.2 }}
                                    className="flex flex-col items-center gap-3 w-full"
                                >
                                    {items[currentIndex].cover_url ? (
                                        <img
                                            src={items[currentIndex].cover_url}
                                            alt={items[currentIndex].title}
                                            className="w-24 h-36 rounded-xl object-cover shadow-lg border border-white/10"
                                        />
                                    ) : (
                                        <div className="w-24 h-36 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shadow-lg border border-white/10">
                                            {items[currentIndex].type === 'Series' ? <Tv className="w-10 h-10" /> : <Clapperboard className="w-10 h-10" />}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <h3 className="font-heading font-bold text-lg text-white leading-tight truncate max-w-[280px]">
                                            {items[currentIndex].title}
                                        </h3>
                                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                            {items[currentIndex].type === 'Series' ? 'Serie' : 'Película'}
                                        </span>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Final Selection actions */}
                {!spinning && selectedItem && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-3 pt-2"
                    >
                        <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">¡Tu destino está marcado!</p>
                        <div className="flex gap-2">
                            <button
                                onClick={startSpin}
                                className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tirar de nuevo
                            </button>
                            <button
                                onClick={async () => {
                                    await onStartItem(selectedItem.id)
                                    onClose()
                                }}
                                className="flex-1 bg-pink-600 hover:bg-pink-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-pink-500/25 flex items-center justify-center gap-1.5"
                            >
                                <Play className="w-4 h-4" />
                                Empezar a ver
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
