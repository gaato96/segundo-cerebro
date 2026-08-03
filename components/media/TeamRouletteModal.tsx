'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Dices, Sparkles, RefreshCw, Trophy, Filter, ShieldAlert, Play } from 'lucide-react'
import { FootballTeam, LEAGUES, getAllTeams } from '@/lib/footballTeams'

export function TeamRouletteModal({
    onClose,
    onSelectTeamForChallenge
}: {
    onClose: () => void
    onSelectTeamForChallenge: (team: FootballTeam) => void
}) {
    const [teams, setTeams] = useState<FootballTeam[]>([])
    const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('All')
    const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<'All' | '1st' | '2nd'>('All')

    const [spinning, setSpinning] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedTeam, setSelectedTeam] = useState<FootballTeam | null>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Load teams on mount
    useEffect(() => {
        const all = getAllTeams()
        setTeams(all)
    }, [])

    const filteredTeams = teams.filter(t => {
        if (selectedLeagueFilter !== 'All' && t.league !== selectedLeagueFilter) return false
        if (selectedDivisionFilter !== 'All' && t.division !== selectedDivisionFilter) return false
        return true
    })

    const filteredTeamsRef = useRef(filteredTeams)
    filteredTeamsRef.current = filteredTeams

    const startSpin = useCallback(() => {
        const list = filteredTeamsRef.current
        if (list.length === 0) return

        if (timerRef.current) clearTimeout(timerRef.current)

        setSpinning(true)
        setSelectedTeam(null)

        const duration = 2200
        const startTime = Date.now()

        const tick = () => {
            const elapsed = Date.now() - startTime
            const currentList = filteredTeamsRef.current

            if (currentList.length === 0) {
                setSpinning(false)
                return
            }

            if (elapsed >= duration) {
                // Ensure a random pick (prefer different from current if possible)
                let finalIdx = Math.floor(Math.random() * currentList.length)
                setCurrentIndex(finalIdx)
                setSelectedTeam(currentList[finalIdx])
                setSpinning(false)
            } else {
                setCurrentIndex((prev) => (prev + 1) % currentList.length)
                const nextDelay = 40 + (elapsed / duration) * 260
                timerRef.current = setTimeout(tick, nextDelay)
            }
        }

        tick()
    }, [])

    // Trigger spin automatically when teams load or filters change
    useEffect(() => {
        if (teams.length > 0 && filteredTeams.length > 0) {
            startSpin()
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [teams.length, selectedLeagueFilter, selectedDivisionFilter])

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#161922] border border-emerald-500/20 w-full max-w-lg flex flex-col rounded-3xl relative overflow-hidden shadow-2xl p-6 text-center space-y-5">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <Trophy className="w-3.5 h-3.5" /> Selector de Modo Carrera
                    </div>
                    <h2 className="text-2xl font-heading font-bold flex items-center justify-center gap-2 text-white">
                        <Dices className="w-6 h-6 text-emerald-400 animate-bounce" />
                        Ruleta de Equipos Aleatorios
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Sortea un club para tu próxima aventura en FM24 o EAFC 26.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 justify-center items-center bg-black/30 p-2.5 rounded-2xl border border-white/5 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold pr-2 border-r border-white/10">
                        <Filter className="w-3.5 h-3.5 text-emerald-400" />
                        Filtros:
                    </div>

                    <select
                        value={selectedLeagueFilter}
                        onChange={(e) => setSelectedLeagueFilter(e.target.value)}
                        className="bg-secondary text-foreground border border-border/60 rounded-xl px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value="All">Todas las Ligas ({teams.length})</option>
                        {LEAGUES.map(l => (
                            <option key={l.name} value={l.name}>{l.flag} {l.name}</option>
                        ))}
                    </select>

                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => setSelectedDivisionFilter('All')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${selectedDivisionFilter === 'All' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                            Todas
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDivisionFilter('1st')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${selectedDivisionFilter === '1st' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                            1ª Div
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDivisionFilter('2nd')}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${selectedDivisionFilter === '2nd' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                            2ª Div
                        </button>
                    </div>
                </div>

                {/* Spinning Wheel Container */}
                <div className="h-56 flex items-center justify-center border border-white/10 bg-gradient-to-b from-black/60 to-black/30 rounded-2xl p-4 overflow-hidden relative shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#161922]/70 via-transparent to-[#161922]/70 pointer-events-none z-10" />

                    {filteredTeams.length === 0 ? (
                        <div className="space-y-2 text-center p-4">
                            <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
                            <p className="text-xs text-muted-foreground">
                                No se encontraron equipos con los filtros seleccionados. Intenta cambiar de liga o división.
                            </p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, scale: 0.85, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.85, y: -15 }}
                                    transition={{ duration: spinning ? 0.04 : 0.2 }}
                                    className="flex flex-col items-center gap-2.5 w-full"
                                >
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/10">
                                        {filteredTeams[currentIndex]?.flag || '⚽'}
                                    </div>

                                    <div className="space-y-1 max-w-[340px]">
                                        <h3 className="font-heading font-black text-2xl text-white leading-tight truncate">
                                            {filteredTeams[currentIndex]?.name || 'Seleccionando...'}
                                        </h3>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-xs text-emerald-400 font-medium">
                                                {filteredTeams[currentIndex]?.league}
                                            </span>
                                            <span className="text-white/20">•</span>
                                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-muted-foreground font-semibold">
                                                {filteredTeams[currentIndex]?.division === '2nd' ? '2ª División' : '1ª División'}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Bottom Action Area (Always rendered so buttons are always visible) */}
                <div className="pt-1">
                    {spinning ? (
                        <button
                            disabled
                            className="w-full py-3 bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 opacity-80 cursor-wait"
                        >
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                            Girando ruleta de equipos...
                        </button>
                    ) : selectedTeam ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">¡Equipo Seleccionado!</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={startSpin}
                                    className="px-4 py-2.5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-white active:scale-95"
                                >
                                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                                    Tirar de nuevo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectTeamForChallenge(selectedTeam)
                                        onClose()
                                    }}
                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Sparkles className="w-4 h-4 fill-white" />
                                    Generar Reto IA con este equipo
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <button
                            type="button"
                            onClick={startSpin}
                            disabled={filteredTeams.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            <Dices className="w-4 h-4" />
                            ¡Girar Ruleta de Equipos!
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
