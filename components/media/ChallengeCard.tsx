'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, CheckCircle2, XCircle, Clock, Trash2, ChevronDown, ChevronUp,
    Sparkles, PlusCircle, MinusCircle, Shield, Award, Target, Flag, Edit3, Plus, RefreshCw, Loader2, CalendarDays
} from 'lucide-react'
import {
    FootballChallenge, FootballObjective,
    updateChallengeSeasons, updateChallengeStatus, toggleObjectiveStatus,
    deleteFootballChallenge, updateChallengeObjectives, regenerateSingleObjective
} from '@/lib/actions/football'

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    trophy: { label: 'Trofeo / Copa', icon: Trophy, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    transfer: { label: 'Fichajes / Presupuesto', icon: Target, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    academy: { label: 'Cantera / Juventud', icon: Award, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    derby: { label: 'Clásico / Rivalidad', icon: Flag, color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    league: { label: 'Liga / Posición', icon: Shield, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
    special: { label: 'Especial / Hito', icon: Sparkles, color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' }
}

const SEASON_COLORS = [
    'border-indigo-500/40 bg-indigo-500/5',
    'border-emerald-500/40 bg-emerald-500/5',
    'border-amber-500/40 bg-amber-500/5',
    'border-purple-500/40 bg-purple-500/5',
    'border-pink-500/40 bg-pink-500/5',
    'border-teal-500/40 bg-teal-500/5',
]
const SEASON_TEXT = [
    'text-indigo-400', 'text-emerald-400', 'text-amber-400',
    'text-purple-400', 'text-pink-400', 'text-teal-400',
]

// Helper to ensure objectives are distributed across seasons if AI or manual input set all to 1
function ensureDistributedSeasons(objs: FootballObjective[]): FootballObjective[] {
    const allOnOneSeason = objs.length > 3 && objs.every(o => !o.season || o.season === 1)
    if (!allOnOneSeason) return objs

    return objs.map((obj, idx) => {
        let seasonNum = Math.floor(idx / 3) + 1
        const textLower = (obj.text || '').toLowerCase()
        if (textLower.includes('triplete') || textLower.includes('champions') || textLower.includes('libertadores') || textLower.includes('26 temporadas')) {
            seasonNum = Math.max(seasonNum, 4)
        } else if (textLower.includes('2 ligas') || textLower.includes('2 copas') || textLower.includes('doblete')) {
            seasonNum = Math.max(seasonNum, 3)
        }
        return { ...obj, season: seasonNum }
    })
}

export function ChallengeCard({
    challenge,
    onUpdate
}: {
    challenge: FootballChallenge
    onUpdate: () => void
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [objectives, setObjectives] = useState<FootballObjective[]>(
        ensureDistributedSeasons(challenge.objectives || [])
    )
    const [seasons, setSeasons] = useState(challenge.seasons_played || 0)
    const [status, setStatus] = useState(challenge.status)
    const [isDeleting, setIsDeleting] = useState(false)

    // Editing state
    const [editingObjId, setEditingObjId] = useState<string | null>(null)
    const [editingText, setEditingText] = useState('')
    const [editingCategory, setEditingCategory] = useState<FootballObjective['category']>('special')
    const [editingSeason, setEditingSeason] = useState(1)

    // Regenerating state
    const [regeneratingObjId, setRegeneratingObjId] = useState<string | null>(null)

    // Add new objective inline
    const [isAddingObj, setIsAddingObj] = useState(false)
    const [newObjText, setNewObjText] = useState('')
    const [newObjCategory, setNewObjCategory] = useState<FootballObjective['category']>('special')
    const [newObjSeason, setNewObjSeason] = useState(1)
    const [isSavingObjs, setIsSavingObjs] = useState(false)

    const completedCount = objectives.filter(o => o.status === 'completed').length
    const failedCount = objectives.filter(o => o.status === 'failed').length
    const totalCount = objectives.length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    // Group objectives by season
    const uniqueSeasons = Array.from(new Set(objectives.map(o => o.season || 1))).sort((a, b) => a - b)
    const seasonNumbers = uniqueSeasons.length > 0 ? uniqueSeasons : [1]
    const objectivesBySeason = (seasonNum: number) =>
        objectives.filter(o => (o.season || 1) === seasonNum)

    async function handleToggleObjective(objId: string, currentStatus: 'pending' | 'completed' | 'failed') {
        let nextStatus: 'pending' | 'completed' | 'failed' = 'completed'
        if (currentStatus === 'pending') nextStatus = 'completed'
        else if (currentStatus === 'completed') nextStatus = 'failed'
        else nextStatus = 'pending'

        try {
            const updated = await toggleObjectiveStatus(challenge.id, objId, nextStatus)
            setObjectives(ensureDistributedSeasons(updated))
            onUpdate()
        } catch (e) {
            console.error('Error updating objective:', e)
        }
    }

    async function handleSeasonChange(delta: number) {
        const newSeasons = Math.max(0, seasons + delta)
        setSeasons(newSeasons)
        try {
            await updateChallengeSeasons(challenge.id, newSeasons)
            onUpdate()
        } catch (e) {
            console.error('Error changing seasons:', e)
        }
    }

    async function handleStatusChange(newStatus: 'Active' | 'Completed' | 'Abandoned') {
        setStatus(newStatus)
        try {
            await updateChallengeStatus(challenge.id, newStatus)
            onUpdate()
        } catch (e) {
            console.error('Error changing status:', e)
        }
    }

    async function handleDeleteChallenge() {
        if (!confirm(`¿Estás seguro de eliminar el reto "${challenge.challenge_title}"?`)) return
        setIsDeleting(true)
        try {
            await deleteFootballChallenge(challenge.id)
            onUpdate()
        } catch (e) {
            alert('Error eliminando reto')
        } finally {
            setIsDeleting(false)
        }
    }

    async function handleChangeObjectiveSeason(objId: string, newSeason: number) {
        const updatedList = objectives.map(obj =>
            obj.id === objId ? { ...obj, season: newSeason } : obj
        ).sort((a, b) => (a.season || 1) - (b.season || 1))

        setIsSavingObjs(true)
        try {
            await updateChallengeObjectives(challenge.id, updatedList)
            setObjectives(updatedList)
            onUpdate()
        } catch (e) {
            alert('Error al cambiar temporada')
        } finally {
            setIsSavingObjs(false)
        }
    }

    async function handleSaveEditedObjective(objId: string) {
        if (!editingText.trim()) return
        setIsSavingObjs(true)
        const updatedList = objectives.map(obj =>
            obj.id === objId
                ? { ...obj, text: editingText.trim(), category: editingCategory, season: editingSeason }
                : obj
        ).sort((a, b) => (a.season || 1) - (b.season || 1))
        try {
            await updateChallengeObjectives(challenge.id, updatedList)
            setObjectives(updatedList)
            setEditingObjId(null)
            onUpdate()
        } catch (e) {
            alert('Error guardando cambios del objetivo')
        } finally {
            setIsSavingObjs(false)
        }
    }

    async function handleDeleteObjective(objId: string) {
        const updatedList = objectives.filter(obj => obj.id !== objId)
        setIsSavingObjs(true)
        try {
            await updateChallengeObjectives(challenge.id, updatedList)
            setObjectives(updatedList)
            onUpdate()
        } catch (e) {
            alert('Error eliminando objetivo')
        } finally {
            setIsSavingObjs(false)
        }
    }

    async function handleAddNewObjective(e: React.FormEvent) {
        e.preventDefault()
        if (!newObjText.trim()) return

        const newObj: FootballObjective = {
            id: `obj-custom-${Date.now()}`,
            text: newObjText.trim(),
            category: newObjCategory,
            season: newObjSeason,
            status: 'pending'
        }

        const updatedList = [...objectives, newObj].sort((a, b) => (a.season || 1) - (b.season || 1))
        setIsSavingObjs(true)
        try {
            await updateChallengeObjectives(challenge.id, updatedList)
            setObjectives(updatedList)
            setNewObjText('')
            setIsAddingObj(false)
            onUpdate()
        } catch (e) {
            alert('Error agregando nuevo objetivo')
        } finally {
            setIsSavingObjs(false)
        }
    }

    async function handleRegenerateObjective(obj: FootballObjective) {
        setRegeneratingObjId(obj.id)
        try {
            const updated = await regenerateSingleObjective({
                challengeId: challenge.id,
                objectiveId: obj.id,
                teamName: challenge.team_name,
                game: challenge.game,
                league: challenge.league,
                category: obj.category,
                season: obj.season || 1,
                currentText: obj.text
            })
            setObjectives(ensureDistributedSeasons(updated))
            onUpdate()
        } catch (e: any) {
            alert(`Error al regenerar objetivo: ${e?.message || 'Error desconocido'}`)
        } finally {
            setRegeneratingObjId(null)
        }
    }

    return (
        <motion.div
            layout
            className={`glass rounded-3xl border transition-all overflow-hidden ${
                status === 'Completed'
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : status === 'Abandoned'
                    ? 'border-red-500/20 bg-red-950/10 opacity-75'
                    : 'border-border/50 hover:border-emerald-500/30'
            }`}
        >
            {/* Header */}
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-black/40 via-transparent to-black/20">
                <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl border text-xl font-bold flex items-center justify-center shrink-0 ${
                        challenge.game === 'FM24'
                            ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                        {challenge.game === 'FM24' ? 'FM24' : 'FC26'}
                    </div>

                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-heading font-black text-xl text-white">{challenge.team_name}</span>
                            {challenge.league && (
                                <span className="text-[11px] bg-secondary/80 px-2.5 py-0.5 rounded-full text-muted-foreground border border-border">
                                    {challenge.league} {challenge.country ? `(${challenge.country})` : ''}
                                </span>
                            )}
                            {challenge.challenge_type && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider">
                                    {challenge.challenge_type}
                                </span>
                            )}
                        </div>
                        <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                            <Trophy className="w-4 h-4 text-emerald-400" />
                            {challenge.challenge_title}
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                    <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value as any)}
                        className={`text-xs font-bold rounded-xl px-3 py-1.5 border outline-none cursor-pointer transition-all ${
                            status === 'Completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : status === 'Abandoned'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                    >
                        <option value="Active">▶ En Carrera (Activo)</option>
                        <option value="Completed">🏆 Reto Cumplido</option>
                        <option value="Abandoned">❌ Reto Abandonado</option>
                    </select>

                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/10 rounded-xl text-muted-foreground hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    <button onClick={handleDeleteChallenge} disabled={isDeleting} className="p-2 hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar Reto">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {challenge.description && (
                <div className="px-5 pt-3 text-xs text-muted-foreground leading-relaxed border-b border-white/5 pb-3 bg-black/10">
                    {challenge.description}
                </div>
            )}

            {/* Progress Bar & Seasons Tracker */}
            <div className="p-5 bg-black/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-semibold">Progreso:</span>
                        <span className="font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {completedCount} / {totalCount} Cumplidos ({progressPct}%)
                        </span>
                        {failedCount > 0 && (
                            <span className="font-bold font-mono text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                                {failedCount} Perdidos
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1 rounded-2xl border border-border/50">
                        <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Temporada actual:</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleSeasonChange(-1)} className="text-muted-foreground hover:text-white transition-colors">
                                <MinusCircle className="w-4 h-4" />
                            </button>
                            <span className="font-mono font-bold text-sm text-white px-2 min-w-[20px] text-center">
                                Temp. {seasons}
                            </span>
                            <button onClick={() => handleSeasonChange(1)} className="text-muted-foreground hover:text-white transition-colors">
                                <PlusCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-full bg-secondary/50 h-2.5 rounded-full overflow-hidden flex border border-white/5">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    {failedCount > 0 && (
                        <div className="bg-red-500/70 h-full transition-all duration-500" style={{ width: `${Math.round((failedCount / totalCount) * 100)}%` }} />
                    )}
                </div>
            </div>

            {/* Objectives Grouped by Season */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-5 border-t border-white/5 space-y-5"
                    >
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                Objetivos Ordenados por Temporada
                            </h5>
                            <button
                                onClick={() => setIsAddingObj(!isAddingObj)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {isAddingObj ? 'Cancelar' : 'Agregar Objetivo'}
                            </button>
                        </div>

                        {/* Add New Objective Form */}
                        {isAddingObj && (
                            <form onSubmit={handleAddNewObjective} className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
                                <p className="text-xs font-bold text-emerald-300">Nuevo Objetivo:</p>
                                <input
                                    required type="text"
                                    placeholder="Ej: Lograr el ascenso a Primera División"
                                    value={newObjText}
                                    onChange={(e) => setNewObjText(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-white"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <select value={newObjCategory} onChange={(e) => setNewObjCategory(e.target.value as any)}
                                        className="bg-secondary border border-border rounded-xl px-2.5 py-1.5 text-xs text-white outline-none">
                                        <option value="trophy">🏆 Trofeo / Copa</option>
                                        <option value="transfer">🎯 Fichajes</option>
                                        <option value="academy">🎖 Cantera</option>
                                        <option value="derby">🚩 Clásico</option>
                                        <option value="league">🛡 Liga</option>
                                        <option value="special">✨ Especial</option>
                                    </select>

                                    <div className="flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="text-xs text-muted-foreground">Temporada:</span>
                                        <input
                                            type="number" min={1} max={30} value={newObjSeason}
                                            onChange={(e) => setNewObjSeason(Number(e.target.value))}
                                            className="w-14 bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-white text-center outline-none"
                                        />
                                    </div>

                                    <div className="flex gap-2 ml-auto">
                                        <button type="button" onClick={() => setIsAddingObj(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white">Cancelar</button>
                                        <button type="submit" disabled={isSavingObjs}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition-all">
                                            {isSavingObjs ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Season Blocks */}
                        {seasonNumbers.map((seasonNum) => {
                            const seasonObjs = objectivesBySeason(seasonNum)
                            if (seasonObjs.length === 0) return null
                            const colorIdx = (seasonNum - 1) % SEASON_COLORS.length
                            const completedInSeason = seasonObjs.filter(o => o.status === 'completed').length

                            return (
                                <div key={seasonNum} className={`rounded-2xl border p-4 space-y-3 ${SEASON_COLORS[colorIdx]}`}>
                                    {/* Season header */}
                                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                        <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${SEASON_TEXT[colorIdx]}`}>
                                            <CalendarDays className="w-4 h-4" />
                                            🗓️ Temporada {seasonNum}
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/40 ${SEASON_TEXT[colorIdx]}`}>
                                            {completedInSeason} / {seasonObjs.length} Completados
                                        </span>
                                    </div>

                                    {/* Objectives in this season */}
                                    <div className="space-y-2.5">
                                        {seasonObjs.map((obj) => {
                                            const catInfo = CATEGORY_LABELS[obj.category] || CATEGORY_LABELS.special
                                            const CatIcon = catInfo.icon
                                            const isEditingThis = editingObjId === obj.id
                                            const isRegenerating = regeneratingObjId === obj.id

                                            return (
                                                <div
                                                    key={obj.id}
                                                    className={`group p-3 rounded-xl border transition-all flex items-start gap-3 ${
                                                        obj.status === 'completed'
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                                            : obj.status === 'failed'
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-300 opacity-80'
                                                            : 'bg-black/30 hover:bg-black/40 border-white/5 text-white'
                                                    }`}
                                                >
                                                    {/* Status toggle button */}
                                                    <button
                                                        onClick={() => handleToggleObjective(obj.id, obj.status)}
                                                        className="shrink-0 mt-0.5 hover:scale-110 transition-transform"
                                                        title="Cambiar estado"
                                                    >
                                                        {obj.status === 'completed'
                                                            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                                                            : obj.status === 'failed'
                                                            ? <XCircle className="w-5 h-5 text-red-400 fill-red-400/20" />
                                                            : <Clock className="w-5 h-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                                                        }
                                                    </button>

                                                    <div className="flex-1 space-y-1.5 min-w-0">
                                                        {isEditingThis ? (
                                                            <div className="space-y-2">
                                                                <input type="text" value={editingText}
                                                                    onChange={(e) => setEditingText(e.target.value)}
                                                                    className="w-full bg-black/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                                                                />
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <select value={editingCategory} onChange={(e) => setEditingCategory(e.target.value as any)}
                                                                        className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white">
                                                                        <option value="trophy">🏆 Trofeo</option>
                                                                        <option value="transfer">🎯 Fichajes</option>
                                                                        <option value="academy">🎖 Cantera</option>
                                                                        <option value="derby">🚩 Clásico</option>
                                                                        <option value="league">🛡 Liga</option>
                                                                        <option value="special">✨ Especial</option>
                                                                    </select>

                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[11px] text-muted-foreground">Temporada:</span>
                                                                        <input type="number" min={1} max={30} value={editingSeason}
                                                                            onChange={(e) => setEditingSeason(Number(e.target.value))}
                                                                            className="w-12 bg-black/60 border border-white/10 rounded-lg px-2 py-0.5 text-[11px] text-white text-center" />
                                                                    </div>

                                                                    <div className="flex gap-1 ml-auto">
                                                                        <button type="button" onClick={() => setEditingObjId(null)} className="text-[11px] text-muted-foreground hover:text-white px-2 py-1">Cancelar</button>
                                                                        <button onClick={() => handleSaveEditedObjective(obj.id)} disabled={isSavingObjs}
                                                                            className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg">
                                                                            Guardar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className={`text-xs font-medium leading-relaxed ${obj.status === 'failed' ? 'line-through' : ''}`}>
                                                                    {obj.text}
                                                                </p>
                                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md border font-semibold ${catInfo.color}`}>
                                                                            <CatIcon className="w-3 h-3" />
                                                                            {catInfo.label}
                                                                        </span>

                                                                        {/* Season Selector Badge */}
                                                                        <select
                                                                            value={obj.season || 1}
                                                                            onChange={(e) => handleChangeObjectiveSeason(obj.id, Number(e.target.value))}
                                                                            className="text-[9px] bg-black/40 text-muted-foreground border border-white/10 rounded px-1.5 py-0.5 font-mono cursor-pointer hover:text-white outline-none"
                                                                            title="Cambiar temporada asignada"
                                                                        >
                                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 26].map(s => (
                                                                                <option key={s} value={s}>Temp. {s}</option>
                                                                            ))}
                                                                        </select>

                                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                                            {obj.status === 'completed' ? '✓ Cumplido' : obj.status === 'failed' ? '✗ Perdido' : '⏳ Pendiente'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Action buttons */}
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {/* Regenerate with AI */}
                                                                        <button
                                                                            onClick={() => handleRegenerateObjective(obj)}
                                                                            disabled={isRegenerating}
                                                                            className="p-1 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                                                            title="Regenerar este objetivo con IA"
                                                                        >
                                                                            {isRegenerating
                                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                                                                : <RefreshCw className="w-3.5 h-3.5" />
                                                                            }
                                                                        </button>
                                                                        {/* Edit */}
                                                                        <button
                                                                            onClick={() => { setEditingObjId(obj.id); setEditingText(obj.text); setEditingCategory(obj.category); setEditingSeason(obj.season || 1) }}
                                                                            className="p-1 text-muted-foreground hover:text-emerald-400 hover:bg-white/5 rounded transition-colors"
                                                                            title="Editar objetivo"
                                                                        >
                                                                            <Edit3 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        {/* Delete */}
                                                                        <button
                                                                            onClick={() => handleDeleteObjective(obj.id)}
                                                                            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                                            title="Eliminar objetivo"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
