'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Dices, Play, RefreshCw, Gamepad2, Sparkles } from 'lucide-react'

interface GameItem {
    id: string
    title: string
    author_or_studio?: string
    cover_url?: string
    progress?: string
}

export function GameRouletteModal({
    games,
    onClose
}: {
    games: GameItem[]
    onClose: () => void
}) {
    const [spinning, setSpinning] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedGame, setSelectedGame] = useState<GameItem | null>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const gamesRef = useRef(games)
    gamesRef.current = games

    const startSpin = useCallback(() => {
        const list = gamesRef.current
        if (list.length === 0) return

        if (timerRef.current) clearTimeout(timerRef.current)

        setSpinning(true)
        setSelectedGame(null)

        const duration = 2200
        const startTime = Date.now()

        const tick = () => {
            const elapsed = Date.now() - startTime
            const currentList = gamesRef.current

            if (currentList.length === 0) {
                setSpinning(false)
                return
            }

            if (elapsed >= duration) {
                const finalIdx = Math.floor(Math.random() * currentList.length)
                setCurrentIndex(finalIdx)
                setSelectedGame(currentList[finalIdx])
                setSpinning(false)
            } else {
                setCurrentIndex((prev) => (prev + 1) % currentList.length)
                const nextDelay = 40 + (elapsed / duration) * 260
                timerRef.current = setTimeout(tick, nextDelay)
            }
        }

        tick()
    }, [])

    useEffect(() => {
        if (games.length > 0) {
            startSpin()
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [games.length])

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#181926] border border-indigo-500/20 w-full max-w-md flex flex-col rounded-3xl relative overflow-hidden shadow-2xl p-6 text-center space-y-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                        <Sparkles className="w-3.5 h-3.5" /> Decisiones de Gaming
                    </div>
                    <h2 className="text-2xl font-heading font-bold flex items-center justify-center gap-2 text-white">
                        <Dices className="w-6 h-6 text-indigo-400 animate-bounce" />
                        ¿Qué juego jugamos hoy?
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Sorteo aleatorio entre tus juegos activos en simultáneo.
                    </p>
                </div>

                {/* Spinning Area */}
                <div className="h-60 flex items-center justify-center border border-white/10 bg-black/40 rounded-2xl p-4 overflow-hidden relative shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#181926]/70 via-transparent to-[#181926]/70 pointer-events-none z-10" />

                    {games.length === 0 ? (
                        <div className="space-y-2 text-center p-4">
                            <Gamepad2 className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                            <p className="text-sm text-muted-foreground">
                                No tienes juegos marcados en "Jugando". Agrega algunos a tu lista en progreso para activar la ruleta.
                            </p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -15 }}
                                    transition={{ duration: spinning ? 0.04 : 0.2 }}
                                    className="flex flex-col items-center gap-3 w-full"
                                >
                                    {games[currentIndex]?.cover_url ? (
                                        <img
                                            src={games[currentIndex].cover_url}
                                            alt={games[currentIndex].title}
                                            className="w-24 h-32 rounded-xl object-cover shadow-lg border border-indigo-500/30"
                                        />
                                    ) : (
                                        <div className="w-24 h-32 rounded-xl bg-indigo-950/40 flex items-center justify-center text-indigo-400 shadow-lg border border-indigo-500/20">
                                            <Gamepad2 className="w-12 h-12" />
                                        </div>
                                    )}

                                    <div className="space-y-0.5 max-w-[280px]">
                                        <h3 className="font-heading font-bold text-lg text-white leading-tight truncate">
                                            {games[currentIndex]?.title || 'Sorteando...'}
                                        </h3>
                                        {games[currentIndex]?.author_or_studio && (
                                            <p className="text-xs text-muted-foreground truncate">{games[currentIndex].author_or_studio}</p>
                                        )}
                                        {games[currentIndex]?.progress && (
                                            <span className="inline-block mt-1 text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-semibold font-mono">
                                                Progreso: {games[currentIndex].progress}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Bottom Action Area */}
                <div className="pt-1">
                    {spinning ? (
                        <button
                            disabled
                            className="w-full py-3 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-300 flex items-center justify-center gap-2 opacity-80 cursor-wait"
                        >
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                            Girando ruleta...
                        </button>
                    ) : selectedGame ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">¡El destino ha hablado!</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={startSpin}
                                    className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-white active:scale-95"
                                >
                                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                                    Volver a girar
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                    <Play className="w-4 h-4 fill-white" />
                                    ¡A jugar!
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <button
                            type="button"
                            onClick={startSpin}
                            disabled={games.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            <Dices className="w-4 h-4" />
                            ¡Girar Ruleta!
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
