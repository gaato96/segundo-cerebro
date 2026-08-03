'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Gamepad2, Dices, Plus, Star, Check, Trash2, Loader2, Play, CircleDot,
    MinusCircle, PlusCircle
} from 'lucide-react'
import { GameRouletteModal } from '@/components/media/GameRouletteModal'
import { RatingModal } from '@/components/media/RatingModal'
import { updateMediaStatus, updateMediaProgress, updateMediaRating, deleteMediaItem, createDetailedMediaItem } from '@/lib/actions/media'

export function GameLibrary({
    items,
    onRefresh
}: {
    items: any[]
    onRefresh: () => Promise<void>
}) {
    const [statusFilter, setStatusFilter] = useState<'Active' | 'Backlog' | 'Finished'>('Active')
    const [rouletteOpen, setRouletteOpen] = useState(false)
    const [ratingItem, setRatingItem] = useState<any | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Manual Game Add
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [gameTitle, setGameTitle] = useState('')
    const [gameStudio, setGameStudio] = useState('')
    const [gameCover, setGameCover] = useState('')
    const [gameStatus, setGameStatus] = useState<'Backlog' | 'Active' | 'Finished'>('Active')
    const [gameNotes, setGameNotes] = useState('')

    const gamesList = items.filter(i => i.type === 'Game')
    const filteredGames = gamesList.filter(g => g.status === statusFilter)
    const activeGames = gamesList.filter(g => g.status === 'Active')

    // Games Percent Tracker Helper
    function parseGameProgress(progressStr: string) {
        const match = progressStr?.match(/(\d+)%/i)
        if (match) return parseInt(match[1])
        const numeric = parseInt(progressStr)
        return isNaN(numeric) ? 0 : numeric
    }

    async function handleGameProgressChange(item: any, newPercent: number) {
        const pct = Math.min(100, Math.max(0, newPercent))
        const newProgress = `${pct}%`
        await updateMediaProgress(item.id, newProgress)
        await onRefresh()
    }

    async function handleStatusChange(id: string, newStatus: 'Backlog' | 'Active' | 'Finished') {
        if (newStatus === 'Finished') {
            const itemToRate = gamesList.find(i => i.id === id)
            if (itemToRate) {
                setRatingItem(itemToRate)
                return
            }
        }

        setActionLoading(id)
        try {
            await updateMediaStatus(id, newStatus)
            await onRefresh()
        } catch (error) {
            alert('Error al cambiar de estado')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleSaveRating(rating: number) {
        if (!ratingItem) return
        setActionLoading(ratingItem.id)
        try {
            await updateMediaRating(ratingItem.id, rating)
            await updateMediaStatus(ratingItem.id, 'Finished')
            await onRefresh()
        } catch (e) {
            alert('Error actualizando calificación')
        } finally {
            setActionLoading(null)
            setRatingItem(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este videojuego de tu lista?')) return
        setActionLoading(id)
        try {
            await deleteMediaItem(id)
            await onRefresh()
        } catch (error) {
            alert('Error eliminando juego')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleAddManualGame(e: React.FormEvent) {
        e.preventDefault()
        if (!gameTitle.trim()) return

        setActionLoading('add-game')
        try {
            await createDetailedMediaItem({
                title: gameTitle,
                type: 'Game',
                status: gameStatus,
                author_or_studio: gameStudio || undefined,
                cover_url: gameCover || undefined,
                notes: gameNotes || 'Añadido a mi catálogo de juegos',
                progress: gameStatus === 'Active' ? '0%' : ''
            })
            await onRefresh()
            setGameTitle('')
            setGameStudio('')
            setGameCover('')
            setGameNotes('')
            setIsAddOpen(false)
        } catch (e) {
            alert('Error al guardar videojuego')
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header & Roulette trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/20 via-black/40 to-black/20">
                <div className="space-y-1">
                    <h3 className="text-xl font-heading font-black text-white flex items-center gap-2">
                        <Gamepad2 className="w-6 h-6 text-indigo-400" />
                        Mi Biblioteca de Videojuegos
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Gestiona tus partidas activas, backlog de juegos y títulos completados.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border border-border flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> Agregar Juego
                    </button>

                    <button
                        onClick={() => setRouletteOpen(true)}
                        className="bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2"
                    >
                        <Dices className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                        🎰 ¿Qué juego jugar hoy? ({activeGames.length})
                    </button>
                </div>
            </div>

            {/* Sub-Filters */}
            <div className="flex gap-2 border-b border-border pb-3">
                {[
                    { id: 'Active', label: '🎮 Jugando Actualmente', count: activeGames.length },
                    { id: 'Backlog', label: '⏳ Pendientes (Backlog)', count: gamesList.filter(g => g.status === 'Backlog').length },
                    { id: 'Finished', label: '🏆 Completados', count: gamesList.filter(g => g.status === 'Finished').length }
                ].map(sub => (
                    <button
                        key={sub.id}
                        onClick={() => setStatusFilter(sub.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            statusFilter === sub.id
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-muted-foreground hover:bg-secondary/40'
                        }`}
                    >
                        {sub.label}
                    </button>
                ))}
            </div>

            {/* Games Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredGames.length === 0 ? (
                    <div className="col-span-full glass rounded-3xl p-12 text-center border border-dashed border-border flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                            <Gamepad2 className="w-8 h-8" />
                        </div>
                        <h4 className="text-base font-heading font-bold text-white">No hay juegos en este estado</h4>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            Agrega juegos a tu biblioteca para llevar un registro de tu progreso.
                        </p>
                        <button
                            onClick={() => setIsAddOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                            + Agregar Videojuego
                        </button>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredGames.map(item => {
                            const isFinished = item.status === 'Finished'
                            const isActive = item.status === 'Active'
                            const progressPct = parseGameProgress(item.progress)

                            return (
                                <motion.div
                                    layout
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`glass p-5 rounded-3xl border transition-all group relative ${
                                        isFinished
                                            ? 'border-border/30 bg-secondary/5 opacity-80 hover:opacity-100'
                                            : 'border-border/50 hover:bg-secondary/15'
                                    }`}
                                >
                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        disabled={actionLoading === item.id}
                                        className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 rounded-md hover:bg-red-500/10 transition-all z-10"
                                    >
                                        {actionLoading === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>

                                    {/* Content Header */}
                                    <div className="flex items-start gap-4">
                                        {item.cover_url ? (
                                            <img
                                                src={item.cover_url}
                                                alt={item.title}
                                                className="w-16 h-24 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-16 h-24 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
                                                <Gamepad2 className="w-7 h-7" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0 pr-6">
                                            <h3 className={`font-bold text-base leading-snug truncate ${isFinished ? 'line-through text-muted-foreground' : 'text-white'}`}>
                                                {item.title}
                                            </h3>
                                            {item.author_or_studio && (
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.author_or_studio}</p>
                                            )}

                                            {/* Rating badge for completed games */}
                                            {isFinished && item.rating !== null && (
                                                <div className="flex items-center gap-1 mt-1.5 text-xs text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 w-fit">
                                                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                                    <span>{Number(item.rating).toFixed(1)}/10</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                                    Videojuego 🎮
                                                </span>
                                                {isActive && (
                                                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                                                        Jugando
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Percent Stepper for Active Games */}
                                    {isActive && (
                                        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">Completado:</span>
                                                <span className="font-bold text-white bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                                                    {item.progress || '0%'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-secondary/35 rounded-xl border border-border/50 px-2 py-1">
                                                    <button onClick={() => handleGameProgressChange(item, progressPct - 10)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-10%</button>
                                                    <button onClick={() => handleGameProgressChange(item, progressPct - 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-5%</button>
                                                    <span className="text-xs font-bold font-mono px-1 min-w-[28px] text-center">{progressPct}%</span>
                                                    <button onClick={() => handleGameProgressChange(item, progressPct + 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+5%</button>
                                                    <button onClick={() => handleGameProgressChange(item, progressPct + 10)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+10%</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3 text-xs">
                                        <div className="text-muted-foreground font-medium">
                                            {isFinished ? 'Completado ✓' : 'En tu lista'}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {!isActive && !isFinished && (
                                                <button
                                                    onClick={() => handleStatusChange(item.id, 'Active')}
                                                    className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl transition-all font-semibold flex items-center gap-1"
                                                >
                                                    <Play className="w-3.5 h-3.5" /> Jugar
                                                </button>
                                            )}

                                            {isActive && (
                                                <button
                                                    onClick={() => handleStatusChange(item.id, 'Finished')}
                                                    className="px-3 py-1.5 bg-green-600/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/20 rounded-xl transition-all font-semibold flex items-center gap-1"
                                                >
                                                    <Check className="w-3.5 h-3.5" /> Completar
                                                </button>
                                            )}

                                            {isFinished && (
                                                <button
                                                    onClick={() => handleStatusChange(item.id, 'Active')}
                                                    className="p-1.5 hover:bg-secondary border border-border/50 text-muted-foreground hover:text-white rounded-lg transition-all"
                                                    title="Volver a Jugando"
                                                >
                                                    <CircleDot className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Game Roulette Modal */}
            {rouletteOpen && (
                <GameRouletteModal
                    games={activeGames}
                    onClose={() => setRouletteOpen(false)}
                />
            )}

            {/* Rating Modal */}
            {ratingItem && (
                <RatingModal
                    title={ratingItem.title}
                    onClose={() => setRatingItem(null)}
                    onSubmit={handleSaveRating}
                />
            )}

            {/* Add Game Modal */}
            <AnimatePresence>
                {isAddOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#161922] border border-white/10 w-full max-w-md rounded-3xl p-6 relative flex flex-col gap-4 shadow-2xl"
                        >
                            <h3 className="text-xl font-heading font-bold text-white">Agregar Videojuego</h3>
                            <form onSubmit={handleAddManualGame} className="space-y-3">
                                <input
                                    required
                                    type="text"
                                    placeholder="Título del juego (ej: Elden Ring, GTA VI)"
                                    value={gameTitle}
                                    onChange={(e) => setGameTitle(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Estudio / Desarrollador (ej: FromSoftware)"
                                    value={gameStudio}
                                    onChange={(e) => setGameStudio(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />
                                <input
                                    type="url"
                                    placeholder="URL de Portada / Imagen (opcional)"
                                    value={gameCover}
                                    onChange={(e) => setGameCover(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                />
                                <select
                                    value={gameStatus}
                                    onChange={(e) => setGameStatus(e.target.value as any)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none"
                                >
                                    <option value="Active">🎮 Jugando Actualmente</option>
                                    <option value="Backlog">⏳ En Pendientes (Backlog)</option>
                                    <option value="Finished">🏆 Completado</option>
                                </select>
                                <textarea
                                    rows={2}
                                    placeholder="Notas o descripción..."
                                    value={gameNotes}
                                    onChange={(e) => setGameNotes(e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none resize-none"
                                />

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddOpen(false)}
                                        className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground py-2.5 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading === 'add-game'}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow"
                                    >
                                        {actionLoading === 'add-game' ? 'Guardando...' : 'Guardar Juego'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
