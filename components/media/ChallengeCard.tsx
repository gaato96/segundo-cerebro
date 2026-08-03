'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, CheckCircle2, XCircle, Clock, Trash2, ChevronDown, ChevronUp,
    Sparkles, PlusCircle, MinusCircle, Shield, Award, Target, Flag, Layers, Edit3, Save, X, Plus
} from 'lucide-react'
import { FootballChallenge, FootballObjective, updateChallengeSeasons, updateChallengeStatus, toggleObjectiveStatus, deleteFootballChallenge, updateChallengeObjectives } from '@/lib/actions/football'

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    trophy: { label: 'Trofeo / Copa', icon: Trophy, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    transfer: { label: 'Fichajes / Presupuesto', icon: Target, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    academy: { label: 'Cantera / Juventud', icon: Award, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    derby: { label: 'Clásico / Rivalidad', icon: Flag, color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    league: { label: 'Liga / Posición', icon: Shield, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
    special: { label: 'Especial / Hito', icon: Sparkles, color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' }
}

export function ChallengeCard({
    challenge,
    onUpdate
}: {
    challenge: FootballChallenge
    onUpdate: () => void
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [objectives, setObjectives] = useState<FootballObjective[]>(challenge.objectives || [])
    const [seasons, setSeasons] = useState(challenge.seasons_played || 0)
    const [status, setStatus] = useState(challenge.status)
    const [isDeleting, setIsDeleting] = useState(false)

    // Editing specific objective
    const [editingObjId, setEditingObjId] = useState<string | null>(null)
    const [editingText, setEditingText] = useState('')
    const [editingCategory, setEditingCategory] = useState<FootballObjective['category']>('special')

    // Add new objective inline
    const [isAddingObj, setIsAddingObj] = useState(false)
    const [newObjText, setNewObjText] = useState('')
    const [newObjCategory, setNewObjCategory] = useState<FootballObjective['category']>('special')
    const [isSavingObjs, setIsSavingObjs] = useState(false)

    const completedCount = objectives.filter(o => o.status === 'completed').length
    const failedCount = objectives.filter(o => o.status === 'failed').length
    const totalCount = objectives.length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    async function handleToggleObjective(objId: string, currentStatus: 'pending' | 'completed' | 'failed') {
        let nextStatus: 'pending' | 'completed' | 'failed' = 'completed'
        if (currentStatus === 'pending') nextStatus = 'completed'
        else if (currentStatus === 'completed') nextStatus = 'failed'
        else nextStatus = 'pending'

        try {
            const updated = await toggleObjectiveStatus(challenge.id, objId, nextStatus)
            setObjectives(updated)
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

    // Save edited objective text / category
    async function handleSaveEditedObjective(objId: string) {
        if (!editingText.trim()) return
        setIsSavingObjs(true)
        const updatedList = objectives.map(obj => {
            if (obj.id === objId) {
                return { ...obj, text: editingText.trim(), category: editingCategory }
            }
            return obj
        })

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

    // Delete a single objective
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

    // Add new objective
    async function handleAddNewObjective(e: React.FormEvent) {
        e.preventDefault()
        if (!newObjText.trim()) return

        const newObj: FootballObjective = {
            id: `obj-custom-${Date.now()}`,
            text: newObjText.trim(),
            category: newObjCategory,
            status: 'pending'
        }

        const updatedList = [...objectives, newObj]
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
                            <span className="font-heading font-black text-xl text-white">
                                {challenge.team_name}
                            </span>
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

                {/* Right controls */}
                <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                    {/* Status selector */}
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

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-white/10 rounded-xl text-muted-foreground hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleDeleteChallenge}
                        disabled={isDeleting}
                        className="p-2 hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-400 transition-colors"
                        title="Eliminar Reto"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Description */}
            {challenge.description && (
                <div className="px-5 pt-3 text-xs text-muted-foreground leading-relaxed border-b border-white/5 pb-3 bg-black/10">
                    {challenge.description}
                </div>
            )}

            {/* Progress Bar & Seasons Tracker */}
            <div className="p-5 bg-black/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-semibold">Progreso del Reto:</span>
                        <span className="font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {completedCount} / {totalCount} Cumplidos ({progressPct}%)
                        </span>
                        {failedCount > 0 && (
                            <span className="font-bold font-mono text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                                {failedCount} Perdidos
                            </span>
                        )}
                    </div>

                    {/* Season Stepper */}
                    <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1 rounded-2xl border border-border/50">
                        <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Temporadas jugadas:</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleSeasonChange(-1)}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <MinusCircle className="w-4 h-4" />
                            </button>
                            <span className="font-mono font-bold text-sm text-white px-2 min-w-[20px] text-center">
                                {seasons}
                            </span>
                            <button
                                onClick={() => handleSeasonChange(1)}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <PlusCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-secondary/50 h-2.5 rounded-full overflow-hidden flex border border-white/5">
                    <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                    {failedCount > 0 && (
                        <div
                            className="bg-red-500/70 h-full transition-all duration-500"
                            style={{ width: `${Math.round((failedCount / totalCount) * 100)}%` }}
                        />
                    )}
                </div>
            </div>

            {/* Objectives Checklist */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-5 border-t border-white/5 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                Lista de Objetivos (Click ícono ⏳/✅/❌ para cambiar estado)
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
                                <p className="text-xs font-bold text-emerald-300">Nuevo Objetivo para {challenge.team_name}:</p>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Fichar un centrodelantero de más de 30 años y hacer 15 goles"
                                    value={newObjText}
                                    onChange={(e) => setNewObjText(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-white"
                                />

                                <div className="flex items-center justify-between gap-2">
                                    <select
                                        value={newObjCategory}
                                        onChange={(e) => setNewObjCategory(e.target.value as any)}
                                        className="bg-secondary border border-border rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                                    >
                                        <option value="trophy">🏆 Trofeo / Copa</option>
                                        <option value="transfer">🎯 Fichajes / Presupuesto</option>
                                        <option value="academy">🎖 Cantera / Juventud</option>
                                        <option value="derby">🚩 Clásico / Rivalidad</option>
                                        <option value="league">🛡 Liga / Posición</option>
                                        <option value="special">✨ Especial / Hito</option>
                                    </select>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingObj(false)}
                                            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSavingObjs}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition-all"
                                        >
                                            {isSavingObjs ? 'Guardando...' : 'Guardar Objetivo'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Objectives List */}
                        <div className="space-y-2">
                            {objectives.map((obj) => {
                                const catInfo = CATEGORY_LABELS[obj.category] || CATEGORY_LABELS.special
                                const CatIcon = catInfo.icon
                                const isEditingThis = editingObjId === obj.id

                                return (
                                    <div
                                        key={obj.id}
                                        className={`group p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                                            obj.status === 'completed'
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                                : obj.status === 'failed'
                                                ? 'bg-red-500/10 border-red-500/30 text-red-300 opacity-80'
                                                : 'bg-secondary/20 hover:bg-secondary/40 border-border/40 text-white'
                                        }`}
                                    >
                                        {/* Status icon trigger */}
                                        <button
                                            onClick={() => handleToggleObjective(obj.id, obj.status)}
                                            className="shrink-0 mt-0.5 hover:scale-110 transition-transform"
                                            title="Cambiar estado (Pendiente ➔ Cumplido ➔ Perdido)"
                                        >
                                            {obj.status === 'completed' ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                                            ) : obj.status === 'failed' ? (
                                                <XCircle className="w-5 h-5 text-red-400 fill-red-400/20" />
                                            ) : (
                                                <Clock className="w-5 h-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                                            )}
                                        </button>

                                        {/* Content / Edit Form */}
                                        <div className="flex-1 space-y-1.5 min-w-0">
                                            {isEditingThis ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editingText}
                                                        onChange={(e) => setEditingText(e.target.value)}
                                                        className="w-full bg-black/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                                                    />
                                                    <div className="flex items-center justify-between">
                                                        <select
                                                            value={editingCategory}
                                                            onChange={(e) => setEditingCategory(e.target.value as any)}
                                                            className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                                                        >
                                                            <option value="trophy">🏆 Trofeo / Copa</option>
                                                            <option value="transfer">🎯 Fichajes</option>
                                                            <option value="academy">🎖 Cantera</option>
                                                            <option value="derby">🚩 Clásico</option>
                                                            <option value="league">🛡 Liga</option>
                                                            <option value="special">✨ Especial</option>
                                                        </select>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setEditingObjId(null)}
                                                                className="text-[11px] text-muted-foreground hover:text-white px-2 py-1"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveEditedObjective(obj.id)}
                                                                disabled={isSavingObjs}
                                                                className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg"
                                                            >
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

                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md border font-semibold ${catInfo.color}`}>
                                                                <CatIcon className="w-3 h-3" />
                                                                {catInfo.label}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {obj.status === 'completed' ? '✓ Cumplido' : obj.status === 'failed' ? '✗ Perdido' : '⏳ Pendiente'}
                                                            </span>
                                                        </div>

                                                        {/* Action Buttons: Edit & Delete */}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingObjId(obj.id)
                                                                    setEditingText(obj.text)
                                                                    setEditingCategory(obj.category)
                                                                }}
                                                                className="p-1 text-muted-foreground hover:text-emerald-400 hover:bg-white/5 rounded transition-colors"
                                                                title="Editar objetivo"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
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
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
