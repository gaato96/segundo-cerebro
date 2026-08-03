'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, Sparkles, Dices, Plus, Search, Filter, Loader2, Gamepad2,
    Shield, Flag, PlusCircle, X, Check, RefreshCw
} from 'lucide-react'
import { FootballChallenge, getFootballChallenges, createFootballChallenge, generateAIFootballChallenge } from '@/lib/actions/football'
import { ChallengeCard } from '@/components/media/ChallengeCard'
import { TeamRouletteModal } from '@/components/media/TeamRouletteModal'
import { FootballTeam, LEAGUES, getAllTeams, saveCustomTeam } from '@/lib/footballTeams'

export function FootballHub() {
    const [challenges, setChallenges] = useState<FootballChallenge[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedGameFilter, setSelectedGameFilter] = useState<'All' | 'FM24' | 'EAFC26'>('All')
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Abandoned'>('Active')

    // Modals
    const [isRouletteOpen, setIsRouletteOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isCustomTeamModalOpen, setIsCustomTeamModalOpen] = useState(false)

    // Generator States
    const [selectedGame, setSelectedGame] = useState<'FM24' | 'EAFC26'>('FM24')
    const [selectedTeam, setSelectedTeam] = useState<FootballTeam | null>(null)
    const [teamSearchQuery, setTeamSearchQuery] = useState('')
    const [allTeams, setAllTeams] = useState<FootballTeam[]>([])
    const [generatingAI, setGeneratingAI] = useState(false)

    // Manual Creation
    const [manualTitle, setManualTitle] = useState('')
    const [manualTeamName, setManualTeamName] = useState('')
    const [manualLeague, setManualLeague] = useState('')
    const [manualObjectivesText, setManualObjectivesText] = useState('')
    const [savingManual, setSavingManual] = useState(false)

    // Custom Team Add
    const [customTeamName, setCustomTeamName] = useState('')
    const [customTeamLeague, setCustomTeamLeague] = useState('')
    const [customTeamCountry, setCustomTeamCountry] = useState('')

    useEffect(() => {
        loadData()
        setAllTeams(getAllTeams())
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const data = await getFootballChallenges()
            setChallenges(data)
        } catch (e) {
            console.error('Error loading football challenges:', e)
        } finally {
            setLoading(false)
        }
    }

    const filteredChallenges = challenges.filter(c => {
        if (selectedGameFilter !== 'All' && c.game !== selectedGameFilter) return false
        if (selectedStatusFilter !== 'All' && c.status !== selectedStatusFilter) return false
        return true
    })

    const filteredTeamsForSelect = allTeams.filter(t => {
        if (!teamSearchQuery.trim()) return true
        const q = teamSearchQuery.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q) || t.country.toLowerCase().includes(q)
    })

    async function handleGenerateAIReto(teamToUse?: FootballTeam) {
        const team = teamToUse || selectedTeam
        if (!team) {
            alert('Por favor selecciona un equipo primero.')
            return
        }

        setGeneratingAI(true)
        try {
            const aiResult = await generateAIFootballChallenge({
                game: selectedGame,
                teamName: team.name,
                league: team.league,
                country: team.country
            })

            await createFootballChallenge({
                game: selectedGame,
                team_name: team.name,
                league: team.league,
                country: team.country,
                challenge_title: aiResult.challenge_title,
                challenge_type: aiResult.challenge_type,
                description: aiResult.description,
                objectives: aiResult.objectives
            })

            await loadData()
            setIsCreateModalOpen(false)
            setSelectedTeam(null)
        } catch (e: any) {
            alert(e.message || 'Error al generar el reto con IA')
        } fontally: {
            setGeneratingAI(false)
        }
    }

    async function handleSaveCustomTeam(e: React.FormEvent) {
        e.preventDefault()
        if (!customTeamName.trim()) return

        saveCustomTeam({
            name: customTeamName,
            league: customTeamLeague || 'Liga Personalizada',
            country: customTeamCountry || 'Internacional',
            flag: '⚽',
            division: '1st'
        })

        const updatedTeams = getAllTeams()
        setAllTeams(updatedTeams)
        setCustomTeamName('')
        setCustomTeamLeague('')
        setCustomTeamCountry('')
        setIsCustomTeamModalOpen(false)
    }

    async function handleSaveManualChallenge(e: React.FormEvent) {
        e.preventDefault()
        if (!manualTitle.trim() || !manualTeamName.trim()) return

        setSavingManual(true)
        try {
            const rawObjs = manualObjectivesText
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)

            const formattedObjs = rawObjs.map((text, idx) => ({
                id: `obj-manual-${idx}`,
                text,
                category: 'special' as const,
                status: 'pending' as const
            }))

            await createFootballChallenge({
                game: selectedGame,
                team_name: manualTeamName,
                league: manualLeague,
                challenge_title: manualTitle,
                challenge_type: 'Custom',
                description: 'Reto creado manualmente.',
                objectives: formattedObjs
            })

            await loadData()
            setManualTitle('')
            setManualTeamName('')
            setManualLeague('')
            setManualObjectivesText('')
            setIsCreateModalOpen(false)
        } catch (e: any) {
            alert('Error guardando reto manual')
        } finally {
            setSavingManual(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Football Banner & Controls */}
            <div className="glass p-6 rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-black/40 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <Trophy className="w-3.5 h-3.5" /> Modo Carrera FM24 & EA Sports FC 26
                    </div>
                    <h2 className="text-2xl font-heading font-black text-white flex items-center gap-2">
                        Retos de Fútbol & Selección de Clubes
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                        Sortea equipos de +13 ligas (incluyendo 2ª división de España, Inglaterra e Italia), genera retos de modo carrera con objetivos realistas impulsados por IA, o crea tus propios desafíos.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5 shrink-0">
                    <button
                        onClick={() => setIsRouletteOpen(true)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Dices className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                        Ruleta de Equipos
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border border-border/60 flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Nuevo Reto IA / Manual
                    </button>
                    <button
                        onClick={() => setIsCustomTeamModalOpen(true)}
                        className="bg-white/5 hover:bg-white/10 text-white px-3 py-2.5 rounded-2xl text-xs font-semibold border border-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Equipo Custom
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-xs text-muted-foreground font-semibold pr-1">Juego:</span>
                    {[
                        { id: 'All', label: 'Todos los Juegos' },
                        { id: 'FM24', label: 'FM24 🟣' },
                        { id: 'EAFC26', label: 'EAFC 26 🟢' }
                    ].map(g => (
                        <button
                            key={g.id}
                            onClick={() => setSelectedGameFilter(g.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                selectedGameFilter === g.id
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'text-muted-foreground hover:bg-secondary/40'
                            }`}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-xs text-muted-foreground font-semibold pr-1">Estado:</span>
                    {[
                        { id: 'Active', label: 'Activos' },
                        { id: 'Completed', label: 'Cumplidos 🏆' },
                        { id: 'Abandoned', label: 'Abandonados' },
                        { id: 'All', label: 'Ver Todos' }
                    ].map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedStatusFilter(s.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                selectedStatusFilter === s.id
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'text-muted-foreground hover:bg-secondary/40'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <p className="text-xs">Cargando tus retos de Modo Carrera...</p>
                </div>
            ) : filteredChallenges.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center border border-dashed border-border flex flex-col items-center justify-center space-y-3">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400">
                        <Trophy className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-heading font-bold text-white">No tienes retos guardados</h3>
                    <p className="text-xs text-muted-foreground max-w-sm">
                        ¡Usa la ruleta de equipos o genera un reto con IA para empezar tu carrera en FM24 o EAFC 26!
                    </p>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setIsRouletteOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                            Girar Ruleta
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        >
                            Crear Reto
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredChallenges.map(challenge => (
                        <ChallengeCard
                            key={challenge.id}
                            challenge={challenge}
                            onUpdate={loadData}
                        />
                    ))}
                </div>
            )}

            {/* Team Roulette Modal */}
            {isRouletteOpen && (
                <TeamRouletteModal
                    onClose={() => setIsRouletteOpen(false)}
                    onSelectTeamForChallenge={(team) => {
                        setSelectedTeam(team)
                        setIsCreateModalOpen(true)
                    }}
                />
            )}

            {/* Create Challenge Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#161922] border border-white/10 w-full max-w-xl rounded-3xl p-6 relative flex flex-col gap-5 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="space-y-1">
                                <h3 className="text-xl font-heading font-black text-white flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-emerald-400" />
                                    Generar Reto de Modo Carrera
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Selecciona el juego y tu equipo para armar una lista de objetivos inteligentes.
                                </p>
                            </div>

                            {/* Game Selector */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGame('FM24')}
                                    className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                        selectedGame === 'FM24'
                                            ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                                            : 'bg-secondary/40 border-border text-muted-foreground'
                                    }`}
                                >
                                    <Gamepad2 className="w-4 h-4" /> Football Manager 2024
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedGame('EAFC26')}
                                    className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                        selectedGame === 'EAFC26'
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                                            : 'bg-secondary/40 border-border text-muted-foreground'
                                    }`}
                                >
                                    <Trophy className="w-4 h-4" /> EA Sports FC 26
                                </button>
                            </div>

                            {/* Option 1: AI Generator from Team List */}
                            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-white/5">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" /> Opción A: Selección con IA
                                </h4>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                                        <input
                                            type="text"
                                            value={teamSearchQuery}
                                            onChange={(e) => setTeamSearchQuery(e.target.value)}
                                            placeholder="Buscar equipo entre los +200 clubes..."
                                            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>

                                    {/* Team selection grid */}
                                    <div className="max-h-40 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl bg-secondary/20">
                                        {filteredTeamsForSelect.slice(0, 30).map((t) => (
                                            <div
                                                key={t.id}
                                                onClick={() => setSelectedTeam(t)}
                                                className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                                    selectedTeam?.id === t.id
                                                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                                        : 'hover:bg-white/5 text-white/90'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{t.flag}</span>
                                                    <span>{t.name}</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{t.league}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedTeam && (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between text-emerald-300">
                                        <span>Equipo seleccionado: <strong>{selectedTeam.name}</strong> ({selectedTeam.league})</span>
                                        <button
                                            disabled={generatingAI}
                                            onClick={() => handleGenerateAIReto()}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow flex items-center gap-1.5"
                                        >
                                            {generatingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                            {generatingAI ? 'Generando...' : 'Generar Reto IA'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Option 2: Manual Creation */}
                            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-white/5">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Opción B: Carga Manual Completa
                                </h4>

                                <form onSubmit={handleSaveManualChallenge} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Título del reto (ej: Reto Athletic Bilbao)"
                                            value={manualTitle}
                                            onChange={(e) => setManualTitle(e.target.value)}
                                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none"
                                        />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Nombre del equipo"
                                            value={manualTeamName}
                                            onChange={(e) => setManualTeamName(e.target.value)}
                                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none"
                                        />
                                    </div>

                                    <textarea
                                        rows={3}
                                        placeholder="Lista de objetivos (uno por línea)&#10;Ejemplo:&#10;Ganar la Copa del Rey&#10;Ascender a 1ª División&#10;Fichar solo jugadores vascos"
                                        value={manualObjectivesText}
                                        onChange={(e) => setManualObjectivesText(e.target.value)}
                                        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none resize-none"
                                    />

                                    <button
                                        type="submit"
                                        disabled={savingManual}
                                        className="w-full bg-secondary hover:bg-secondary/80 text-foreground py-2 rounded-xl text-xs font-bold transition-all border border-border"
                                    >
                                        {savingManual ? 'Guardando...' : 'Guardar Reto Manual'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Team Add Modal */}
            <AnimatePresence>
                {isCustomTeamModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#161922] border border-white/10 w-full max-w-md rounded-3xl p-6 relative flex flex-col gap-4 shadow-2xl"
                        >
                            <button
                                onClick={() => setIsCustomTeamModalOpen(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h3 className="text-lg font-bold font-heading text-white">Agregar Equipo Custom</h3>
                            <form onSubmit={handleSaveCustomTeam} className="space-y-3">
                                <input
                                    required
                                    type="text"
                                    placeholder="Nombre del club (ej: Ferro Carril Oeste)"
                                    value={customTeamName}
                                    onChange={(e) => setCustomTeamName(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Liga (ej: Primera Nacional)"
                                    value={customTeamLeague}
                                    onChange={(e) => setCustomTeamLeague(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="País (ej: Argentina)"
                                    value={customTeamCountry}
                                    onChange={(e) => setCustomTeamCountry(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />

                                <button
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow"
                                >
                                    Guardar Equipo en mi Lista
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
