'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Library, Plus, Tv, Book, Gamepad, Clapperboard, Check, Trash2, X, Loader2, Play,
    CircleDot, Search, Sparkles, Star, Award, Dices, ChevronRight, Settings, PlusCircle, MinusCircle, AlertCircle
} from 'lucide-react'
import { createMediaItem, createDetailedMediaItem, updateMediaStatus, updateMediaProgress, updateMediaRating, deleteMediaItem, getAIMediaRecommendations } from '@/lib/actions/media'
import { TMDBConfigCard } from '@/components/media/TMDBConfigCard'
import { MediaRouletteModal } from '@/components/media/MediaRouletteModal'
import { RatingModal } from '@/components/media/RatingModal'

interface MediaItem {
    id: string
    type: 'Movie' | 'Series' | 'Book' | 'Game'
    title: string
    author_or_studio?: string
    status: 'Backlog' | 'Active' | 'Finished'
    progress: string
    rating: number | null
    cover_url?: string
    notes?: string
    created_at: string
}

export function MediaClient({ initialItems }: { initialItems: MediaItem[] }) {
    const [items, setItems] = useState<MediaItem[]>(initialItems)
    const [activeTab, setActiveTab] = useState<'Movies' | 'Series' | 'Recommendations' | 'Others'>('Movies')
    const [subFilter, setSubFilter] = useState<'Backlog' | 'Active' | 'Finished'>('Active')
    
    // TMDB Search States
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showConfig, setShowConfig] = useState(false)
    const [tmdbApiKey, setTmdbApiKey] = useState('')

    // Modals
    const [rouletteOpen, setRouletteOpen] = useState(false)
    const [ratingItem, setRatingItem] = useState<MediaItem | null>(null)
    const [customTitle, setCustomTitle] = useState('')
    const [customType, setCustomType] = useState<'Movie' | 'Series'>('Movie')
    const [isManualOpen, setIsManualOpen] = useState(false)

    // Recommendations State
    const [aiRecommendations, setAiRecommendations] = useState<any[]>([])
    const [loadingRecs, setLoadingRecs] = useState(false)
    const [recsError, setRecsError] = useState<string | null>(null)

    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Read API Key from LocalStorage on mount
    useEffect(() => {
        const storedKey = localStorage.getItem('tmdb_api_key')
        if (storedKey) setTmdbApiKey(storedKey)
    }, [])

    // Load AI recommendations when Recommendations tab is active
    useEffect(() => {
        if (activeTab === 'Recommendations') {
            loadRecommendations()
        }
    }, [activeTab])

    async function loadRecommendations() {
        setLoadingRecs(true)
        setRecsError(null)
        try {
            const res = await getAIMediaRecommendations()
            if (res.error) {
                setRecsError(res.error)
            } else if (res.data?.recommendations) {
                setAiRecommendations(res.data.recommendations)
            }
        } catch (e: any) {
            setRecsError('Error cargando recomendaciones: ' + e.message)
        } finally {
            setLoadingRecs(false)
        }
    }

    // TMDB Multi Search
    async function handleSearch(queryStr: string) {
        setSearchQuery(queryStr)
        if (!queryStr.trim()) {
            setSearchResults([])
            return
        }

        const apiKey = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY
        if (!apiKey) {
            // If no API key, we can't search TMDB
            return
        }

        setIsSearching(true)
        try {
            const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(queryStr)}&language=es-AR`
            const res = await fetch(url)
            const data = await res.json()
            if (data.results) {
                // Filter only movies and tv shows
                const filtered = data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
                setSearchResults(filtered)
            }
        } catch (e) {
            console.error('TMDB Search Error:', e)
        } finally {
            setIsSearching(false)
        }
    }

    // Add movie or show from TMDB search
    async function handleAddTMDBItem(tmdbItem: any, targetStatus: 'Backlog' | 'Active') {
        const isMovie = tmdbItem.media_type === 'movie'
        const title = isMovie ? tmdbItem.title : tmdbItem.name
        const type = isMovie ? 'Movie' : 'Series'
        const cover_url = tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : undefined
        const author_or_studio = isMovie ? '' : tmdbItem.first_air_date ? tmdbItem.first_air_date.substring(0, 4) : ''
        const notes = tmdbItem.overview || ''

        setActionLoading(tmdbItem.id.toString())
        try {
            await createDetailedMediaItem({
                title,
                type,
                status: targetStatus,
                cover_url,
                author_or_studio,
                notes
            })
            // Reload local items
            const updated = await fetchUpdatedItems()
            setItems(updated)
            setSearchQuery('')
            setSearchResults([])
        } catch (e) {
            alert('Error agregando película/serie.')
        } finally {
            setActionLoading(null)
        }
    }

    // Manual item creation
    async function handleAddManual(e: React.FormEvent) {
        e.preventDefault()
        if (!customTitle.trim()) return
        setActionLoading('manual')
        try {
            await createDetailedMediaItem({
                title: customTitle,
                type: customType,
                status: 'Backlog',
                notes: 'Cargado manualmente'
            })
            const updated = await fetchUpdatedItems()
            setItems(updated)
            setCustomTitle('')
            setIsManualOpen(false)
        } catch (e) {
            alert('Error al guardar')
        } finally {
            setActionLoading(null)
        }
    }

    // Helper to fetch latest list
    async function fetchUpdatedItems() {
        const data = await createClientList()
        return data
    }

    // Helper to mimic getMediaBacklog in client-side
    async function createClientList() {
        const { getMediaBacklog: getMediaBacklogAction } = require('@/lib/actions/media')
        return await getMediaBacklogAction()
    }

    async function handleStatusChange(id: string, newStatus: 'Backlog' | 'Active' | 'Finished') {
        // If status changes to Finished, open RatingModal first
        if (newStatus === 'Finished') {
            const itemToRate = items.find(i => i.id === id)
            if (itemToRate) {
                setRatingItem(itemToRate)
                return
            }
        }

        setActionLoading(id)
        try {
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
            await updateMediaStatus(id, newStatus)
        } catch (error) {
            alert('Error al cambiar de estado')
        } finally {
            setActionLoading(null)
        }
    }

    // Episode Tracking Parser/Helpers
    function parseSeriesProgress(progressStr: string) {
        const match = progressStr?.match(/S(\d+)\s*Ep\s*(\d+)/i) || progressStr?.match(/S(\d+)E(\d+)/i)
        if (match) {
            return { season: parseInt(match[1]), episode: parseInt(match[2]) }
        }
        return { season: 1, episode: 1 }
    }

    async function handleEpisodeChange(item: MediaItem, increment: boolean) {
        const { season, episode } = parseSeriesProgress(item.progress)
        let newEpisode = episode
        if (increment) {
            newEpisode += 1
        } else {
            newEpisode = Math.max(1, episode - 1)
        }

        const newProgress = `S${season} Ep ${newEpisode}`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    async function handleSeasonChange(item: MediaItem, increment: boolean) {
        const { season } = parseSeriesProgress(item.progress)
        let newSeason = season
        if (increment) {
            newSeason += 1
        } else {
            newSeason = Math.max(1, season - 1)
        }

        const newProgress = `S${newSeason} Ep 1`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    async function handleFinishSeason(item: MediaItem) {
        // Prompts rating for the finished season, then increments season and resets episode to 1
        setRatingItem(item)
    }

    async function handleSaveRating(rating: number) {
        if (!ratingItem) return
        setActionLoading(ratingItem.id)
        try {
            await updateMediaRating(ratingItem.id, rating)
            
            // If it is a Series and we want to advance season, we ask or do it based on progress
            const isSeries = ratingItem.type === 'Series'
            
            if (isSeries && ratingItem.status === 'Active') {
                const proceed = confirm('¿Deseas avanzar a la siguiente temporada? (Cancelar lo archivará en Terminadas)')
                if (proceed) {
                    const { season } = parseSeriesProgress(ratingItem.progress)
                    const nextProgress = `S${season + 1} Ep 1`
                    await updateMediaProgress(ratingItem.id, nextProgress)
                    
                    setItems(prev => prev.map(i => i.id === ratingItem.id ? { ...i, rating, progress: nextProgress } : i))
                    setActionLoading(null)
                    setRatingItem(null)
                    return
                }
            }

            // Otherwise, archive the series/movie as Finished
            await updateMediaStatus(ratingItem.id, 'Finished')
            setItems(prev => prev.map(i => i.id === ratingItem.id ? { ...i, status: 'Finished', rating } : i))
        } catch (e) {
            alert('Error actualizando calificación')
        } finally {
            setActionLoading(null)
            setRatingItem(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este título de tu lista?')) return
        setActionLoading(id)
        try {
            await deleteMediaItem(id)
            setItems(prev => prev.filter(i => i.id !== id))
        } catch (error) {
            alert('Error eliminando')
        } finally {
            setActionLoading(null)
        }
    }

    // Filter Items by active Tab & subFilter
    const filteredItems = items.filter(item => {
        if (activeTab === 'Movies') {
            if (item.type !== 'Movie') return false
            return item.status === subFilter
        }
        if (activeTab === 'Series') {
            if (item.type !== 'Series') return false
            return item.status === subFilter
        }
        if (activeTab === 'Others') {
            if (item.type === 'Movie' || item.type === 'Series') return false
            return true // Games & Books
        }
        return false
    })

    const hasTMDBCredential = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Entretenimiento
                        <Library className="w-6 h-6 text-pink-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Centro multimedia de series, películas, libros y juegos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2.5 rounded-xl border transition-colors ${showConfig ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'glass hover:bg-secondary'}`}
                        title="Configurar TMDB Key"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setIsManualOpen(true)}
                        className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                        Carga Manual
                    </button>
                    {filteredItems.length > 0 && subFilter === 'Backlog' && activeTab !== 'Recommendations' && activeTab !== 'Others' && (
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-pink-500/25 flex items-center justify-center gap-2"
                        >
                            <Dices className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                            Ruleta de Backlog
                        </button>
                    )}
                </div>
            </div>

            {/* TMDB API Key config box */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <TMDBConfigCard />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Input Box */}
            <div className="relative max-w-2xl">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-muted-foreground" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={hasTMDBCredential ? "Buscar películas o series en vivo por TMDB..." : "Configura tu API Key de TMDB para buscar carteleras reales aquí..."}
                    disabled={!hasTMDBCredential}
                    className="w-full bg-secondary/30 border border-border/50 rounded-2xl pl-10 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                />
                {isSearching && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                        <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
                    </div>
                )}
            </div>

            {/* TMDB Live Search Results Dropdown */}
            {searchResults.length > 0 && searchQuery && (
                <div className="glass rounded-2xl border border-border/50 bg-[#1a1b26] shadow-2xl p-4 max-h-[400px] overflow-y-auto max-w-2xl space-y-3 z-30 relative animate-slide-down">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resultados de búsqueda ({searchResults.length})</span>
                        <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-xs text-muted-foreground hover:text-white">Cerrar</button>
                    </div>
                    <div className="divide-y divide-white/5">
                        {searchResults.map((res: any) => {
                            const isMovie = res.media_type === 'movie'
                            const title = isMovie ? res.title : res.name
                            const date = isMovie ? res.release_date : res.first_air_date
                            const year = date ? `(${date.substring(0, 4)})` : ''
                            const poster = res.poster_path ? `https://image.tmdb.org/t/p/w92${res.poster_path}` : null

                            return (
                                <div key={res.id} className="py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02] px-2 rounded-lg group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {poster ? (
                                            <img src={poster} alt={title} className="w-10 h-14 rounded-md object-cover border border-white/10 shrink-0" />
                                        ) : (
                                            <div className="w-10 h-14 rounded-md bg-secondary flex items-center justify-center text-muted-foreground border border-white/10 shrink-0">
                                                {isMovie ? <Clapperboard className="w-5 h-5" /> : <Tv className="w-5 h-5" />}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-white/90 truncate">{title} {year}</p>
                                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                                {isMovie ? 'Película' : 'Serie'}
                                            </span>
                                            {res.overview && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">{res.overview}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                        <button
                                            disabled={actionLoading === res.id.toString()}
                                            onClick={() => handleAddTMDBItem(res, 'Backlog')}
                                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg flex items-center gap-1 border border-border"
                                        >
                                            {actionLoading === res.id.toString() ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Pendiente'}
                                        </button>
                                        <button
                                            disabled={actionLoading === res.id.toString()}
                                            onClick={() => handleAddTMDBItem(res, 'Active')}
                                            className="px-2.5 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-xs font-semibold rounded-lg flex items-center gap-1 border border-pink-500/20"
                                        >
                                            {actionLoading === res.id.toString() ? <Loader2 className="w-3 h-3 animate-spin" /> : '▶ Ver ahora'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Main Tabs */}
            <div className="flex gap-2 border-b border-border pb-px overflow-x-auto no-scrollbar">
                {[
                    { id: 'Movies', label: 'Películas', icon: Clapperboard },
                    { id: 'Series', label: 'Series', icon: Tv },
                    { id: 'Recommendations', label: 'Recomendaciones IA', icon: Sparkles },
                    { id: 'Others', label: 'Otros (Libros/Juegos)', icon: Library }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-pink-500 text-pink-400 font-bold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SubFilters for Movies / Series */}
            {activeTab !== 'Recommendations' && activeTab !== 'Others' && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {[
                        { id: 'Backlog', label: 'Pendientes' },
                        { id: 'Active', label: 'En Progreso' },
                        { id: 'Finished', label: 'Terminadas' }
                    ].map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => setSubFilter(sub.id as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                subFilter === sub.id
                                    ? 'bg-pink-600/10 text-pink-400 border border-pink-500/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            }`}
                        >
                            {sub.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Active Content Grid */}
            {activeTab === 'Recommendations' ? (
                /* Recommendations Layout */
                <div className="space-y-6">
                    {loadingRecs ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                            <p className="text-sm">Analizando tu catálogo y generando recomendaciones personalizadas...</p>
                        </div>
                    ) : recsError ? (
                        <div className="glass p-8 text-center rounded-2xl border border-red-500/10 text-red-400 max-w-md mx-auto space-y-4">
                            <AlertCircle className="w-8 h-8 mx-auto" />
                            <p className="text-sm font-semibold">{recsError}</p>
                            <button onClick={loadRecommendations} className="px-4 py-2 bg-secondary rounded-lg text-xs hover:bg-secondary/80 text-foreground transition-all">Reintentar</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiRecommendations.map((rec, i) => (
                                <div key={i} className="glass p-5 rounded-2xl border border-border/50 hover:bg-secondary/15 transition-all flex items-start gap-4">
                                    <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl shrink-0 mt-0.5">
                                        {rec.type === 'Series' ? <Tv className="w-6 h-6" /> : <Clapperboard className="w-6 h-6" />}
                                    </div>
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <h3 className="font-heading font-bold text-lg text-white leading-snug">{rec.title}</h3>
                                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground border border-border capitalize">
                                            {rec.type === 'Series' ? 'Serie Recomendada' : 'Película Recomendada'}
                                        </span>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>
                                        
                                        {/* Button to quickly add to backlog */}
                                        <button
                                            onClick={async () => {
                                                setActionLoading(`rec-${i}`)
                                                try {
                                                    // Add with detailed search if possible or raw
                                                    await createDetailedMediaItem({
                                                        title: rec.title,
                                                        type: rec.type === 'Series' ? 'Series' : 'Movie',
                                                        status: 'Backlog',
                                                        notes: 'Recomendado por Inteligencia Artificial'
                                                    })
                                                    alert(`"${rec.title}" se agregó a tu backlog pendiente!`)
                                                    const updated = await fetchUpdatedItems()
                                                    setItems(updated)
                                                } catch (e) {
                                                    alert('Error agregando recomendación')
                                                } finally {
                                                    setActionLoading(null)
                                                }
                                            }}
                                            disabled={actionLoading === `rec-${i}`}
                                            className="text-xs text-indigo-400 font-semibold flex items-center gap-1 hover:text-indigo-300 transition-colors pt-1"
                                        >
                                            {actionLoading === `rec-${i}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                            Añadir a pendientes
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Regular Backlog Items Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredItems.length === 0 ? (
                        <div className="col-span-full glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-4">
                                <Library className="w-8 h-8 text-pink-500" />
                            </div>
                            <h3 className="text-lg font-heading font-medium">No hay contenido acá</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                Tu lista está vacía. Busca películas o series arriba para cargarlas a tu backlog.
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map(item => {
                                const isSeries = item.type === 'Series'
                                const isMovie = item.type === 'Movie'
                                const isFinished = item.status === 'Finished'
                                const isActive = item.status === 'Active'
                                const progress = isSeries ? parseSeriesProgress(item.progress) : null

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

                                        {/* Card content */}
                                        <div className="flex items-start gap-4">
                                            {item.cover_url ? (
                                                <img
                                                    src={item.cover_url}
                                                    alt={item.title}
                                                    className="w-16 h-24 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
                                                />
                                            ) : (
                                                <div className="w-16 h-24 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shadow-md border border-white/10 shrink-0">
                                                    {isSeries ? <Tv className="w-7 h-7" /> : <Clapperboard className="w-7 h-7" />}
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0 pr-6">
                                                <h3 className={`font-bold text-base leading-snug truncate ${isFinished ? 'line-through text-muted-foreground' : 'text-white'}`}>
                                                    {item.title}
                                                </h3>
                                                {item.author_or_studio && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.author_or_studio}</p>
                                                )}
                                                
                                                {/* Ratings Badge for completed items */}
                                                {isFinished && item.rating !== null && (
                                                    <div className="flex items-center gap-1 mt-1.5 text-xs text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 w-fit">
                                                        <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                                        <span>{Number(item.rating).toFixed(1)}/10</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                                        {item.type === 'Movie' ? 'Película' : item.type === 'Series' ? 'Serie' : item.type === 'Book' ? 'Libro' : 'Juego'}
                                                    </span>
                                                    {isActive && (
                                                        <span className="text-[10px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-medium">
                                                            {isSeries ? 'Viendo' : isMovie ? 'Viendo' : item.type === 'Book' ? 'Leyendo' : 'Jugando'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tracker Stepper for Active Series */}
                                        {isActive && isSeries && progress && (
                                            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Progreso de episodios:</span>
                                                    <span className="font-bold text-white bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{item.progress}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* Episode controls */}
                                                    <div className="flex items-center gap-1.5 bg-secondary/35 rounded-xl border border-border/50 px-2.5 py-1">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1">Episodio</span>
                                                        <button onClick={() => handleEpisodeChange(item, false)} className="text-muted-foreground hover:text-white"><MinusCircle className="w-4 h-4" /></button>
                                                        <span className="text-xs font-bold font-mono px-1 min-w-[16px] text-center">{progress.episode}</span>
                                                        <button onClick={() => handleEpisodeChange(item, true)} className="text-muted-foreground hover:text-white"><PlusCircle className="w-4 h-4" /></button>
                                                    </div>

                                                    {/* Season controls */}
                                                    <div className="flex items-center gap-1.5 bg-secondary/35 rounded-xl border border-border/50 px-2.5 py-1">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1">Temp</span>
                                                        <button onClick={() => handleSeasonChange(item, false)} className="text-muted-foreground hover:text-white"><MinusCircle className="w-4 h-4" /></button>
                                                        <span className="text-xs font-bold font-mono px-1 min-w-[16px] text-center">{progress.season}</span>
                                                        <button onClick={() => handleSeasonChange(item, true)} className="text-muted-foreground hover:text-white"><PlusCircle className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom Action trigger */}
                                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3 text-xs">
                                            {isSeries && isActive ? (
                                                <button
                                                    onClick={() => handleFinishSeason(item)}
                                                    className="text-pink-400 font-semibold hover:underline flex items-center gap-1"
                                                >
                                                    Terminar Temporada {progress?.season}
                                                </button>
                                            ) : (
                                                <div className="text-muted-foreground">
                                                    {isFinished ? 'Finalizado' : 'En tu Backlog'}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 shrink-0">
                                                {!isActive && !isFinished && (
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'Active')}
                                                        className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl transition-all font-semibold flex items-center gap-1"
                                                    >
                                                        <Play className="w-3.5 h-3.5" />
                                                        Empezar
                                                    </button>
                                                )}

                                                {isActive && (
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'Finished')}
                                                        className="px-3 py-1.5 bg-green-600/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/20 rounded-xl transition-all font-semibold flex items-center gap-1"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        Finalizar
                                                    </button>
                                                )}

                                                {isFinished && (
                                                    <button
                                                        onClick={() => handleStatusChange(item.id, 'Active')}
                                                        className="p-1.5 hover:bg-secondary border border-border/50 text-muted-foreground hover:text-white rounded-lg transition-all"
                                                        title="Volver a Activo"
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
            )}

            {/* Roulette Modal Component */}
            {rouletteOpen && (
                <MediaRouletteModal
                    items={filteredItems.filter(i => i.status === 'Backlog')}
                    onClose={() => setRouletteOpen(false)}
                    onStartItem={async (id) => {
                        await handleStatusChange(id, 'Active')
                        setRouletteOpen(false)
                    }}
                />
            )}

            {/* Rating Modal Component */}
            {ratingItem && (
                <RatingModal
                    title={ratingItem.title}
                    onClose={() => setRatingItem(null)}
                    onSubmit={handleSaveRating}
                />
            )}

            {/* Manual item creation modal */}
            <AnimatePresence>
                {isManualOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1b26] border border-white/10 w-full max-w-md rounded-3xl p-6 relative flex flex-col gap-4 shadow-2xl"
                        >
                            <button onClick={() => setIsManualOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-muted-foreground"><X className="w-5 h-5" /></button>
                            <h2 className="text-xl font-bold font-heading">Agregar Título Manual</h2>
                            <form onSubmit={handleAddManual} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
                                    <select
                                        value={customType}
                                        onChange={(e) => setCustomType(e.target.value as any)}
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none"
                                    >
                                        <option value="Movie">Película</option>
                                        <option value="Series">Serie</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Título</label>
                                    <input
                                        required
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        placeholder="Ej: El Padrino, Breaking Bad..."
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'manual'}
                                    className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow shadow-pink-600/20"
                                >
                                    {actionLoading === 'manual' ? 'Guardando...' : 'Añadir al Backlog'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
