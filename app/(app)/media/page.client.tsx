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
    
    // Sub-filters for Books/Games
    const [othersTypeFilter, setOthersTypeFilter] = useState<'All' | 'Book' | 'Game'>('All')
    const [othersStatusFilter, setOthersStatusFilter] = useState<'Backlog' | 'Active' | 'Finished'>('Active')

    // TMDB Search States
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showConfig, setShowConfig] = useState(false)
    const [tmdbApiKey, setTmdbApiKey] = useState('')

    // Trending States
    const [trendingMovies, setTrendingMovies] = useState<any[]>([])
    const [trendingSeries, setTrendingSeries] = useState<any[]>([])
    const [loadingTrending, setLoadingTrending] = useState(false)

    // Modals
    const [rouletteOpen, setRouletteOpen] = useState(false)
    const [ratingItem, setRatingItem] = useState<MediaItem | null>(null)
    const [ratingTMDBItem, setRatingTMDBItem] = useState<any | null>(null)
    
    // Manual Creation States
    const [isManualOpen, setIsManualOpen] = useState(false)
    const [customTitle, setCustomTitle] = useState('')
    const [customType, setCustomType] = useState<'Movie' | 'Series' | 'Book' | 'Game'>('Movie')
    const [customStatus, setCustomStatus] = useState<'Backlog' | 'Active' | 'Finished'>('Backlog')
    const [customRating, setCustomRating] = useState<number>(8.0)
    const [customNotes, setCustomNotes] = useState('')
    const [customAuthor, setCustomAuthor] = useState('')

    // Recommendations State
    const [recCategory, setRecCategory] = useState<'cine' | 'books_games'>('cine')
    const [aiRecommendations, setAiRecommendations] = useState<any[]>([])
    const [loadingRecs, setLoadingRecs] = useState(false)
    const [recsError, setRecsError] = useState<string | null>(null)

    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Read API Key from LocalStorage on mount
    useEffect(() => {
        const storedKey = localStorage.getItem('tmdb_api_key')
        if (storedKey) {
            setTmdbApiKey(storedKey)
        }
    }, [])

    // Fetch trending on mount or when API key is loaded
    useEffect(() => {
        const apiKey = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY
        if (apiKey) {
            fetchTrending(apiKey)
        }
    }, [tmdbApiKey])

    // Load AI recommendations when Recommendations tab is active
    useEffect(() => {
        if (activeTab === 'Recommendations') {
            loadRecommendations(recCategory)
        }
    }, [activeTab, recCategory])

    async function fetchTrending(apiKey: string) {
        setLoadingTrending(true)
        try {
            const moviesUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=es-AR`
            const moviesRes = await fetch(moviesUrl)
            const moviesData = await moviesRes.json()
            if (moviesData.results) {
                setTrendingMovies(moviesData.results.slice(0, 10))
            }

            const seriesUrl = `https://api.themoviedb.org/3/trending/tv/week?api_key=${apiKey}&language=es-AR`
            const seriesRes = await fetch(seriesUrl)
            const seriesData = await seriesRes.json()
            if (seriesData.results) {
                setTrendingSeries(seriesData.results.slice(0, 10))
            }
        } catch (e) {
            console.error('TMDB Trending Error:', e)
        } finally {
            setLoadingTrending(false)
        }
    }

    async function loadRecommendations(category: 'cine' | 'books_games') {
        setLoadingRecs(true)
        setRecsError(null)
        try {
            const res = await getAIMediaRecommendations(category)
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
        if (!apiKey) return

        setIsSearching(true)
        try {
            const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(queryStr)}&language=es-AR`
            const res = await fetch(url)
            const data = await res.json()
            if (data.results) {
                const filtered = data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
                setSearchResults(filtered)
            }
        } catch (e) {
            console.error('TMDB Search Error:', e)
        } finally {
            setIsSearching(false)
        }
    }

    // Helper to fetch latest list
    async function fetchUpdatedItems() {
        const { getMediaBacklog: getMediaBacklogAction } = require('@/lib/actions/media')
        return await getMediaBacklogAction()
    }

    // Add movie or show from TMDB
    async function handleAddTMDBItem(tmdbItem: any, targetStatus: 'Backlog' | 'Active', ratingVal?: number) {
        const isMovie = tmdbItem.media_type === 'movie' || (tmdbItem.title !== undefined)
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
                notes,
                rating: ratingVal || null
            })
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

    // Add TMDB item as Finished with rating
    async function handleAddTMDBItemWithRating(rating: number) {
        if (!ratingTMDBItem) return
        const isMovie = ratingTMDBItem.media_type === 'movie' || (ratingTMDBItem.title !== undefined)
        const title = isMovie ? ratingTMDBItem.title : ratingTMDBItem.name
        const type = isMovie ? 'Movie' : 'Series'
        const cover_url = ratingTMDBItem.poster_path ? `https://image.tmdb.org/t/p/w500${ratingTMDBItem.poster_path}` : undefined
        const author_or_studio = isMovie ? '' : ratingTMDBItem.first_air_date ? ratingTMDBItem.first_air_date.substring(0, 4) : ''
        const notes = ratingTMDBItem.overview || ''

        setActionLoading(ratingTMDBItem.id.toString())
        try {
            await createDetailedMediaItem({
                title,
                type,
                status: 'Finished',
                cover_url,
                author_or_studio,
                notes,
                rating
            })
            const updated = await fetchUpdatedItems()
            setItems(updated)
            setSearchQuery('')
            setSearchResults([])
            setRatingTMDBItem(null)
        } catch (e) {
            alert('Error agregando elemento calificado.')
        } finally {
            setActionLoading(null)
        }
    }

    // Add recommended item using metadata search
    async function handleAddRecommendation(rec: any, idx: number) {
        setActionLoading(`rec-${idx}`)
        const apiKey = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY
        let cover_url = undefined
        let author_or_studio = undefined
        let notes = rec.reason || 'Recomendado por Inteligencia Artificial'

        if (apiKey && (rec.type === 'Movie' || rec.type === 'Series')) {
            try {
                const searchType = rec.type === 'Series' ? 'tv' : 'movie'
                const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(rec.title)}&language=es-AR`
                const res = await fetch(url)
                const data = await res.json()
                if (data.results) {
                    const match = data.results.find((r: any) => 
                        r.media_type === searchType && 
                        (rec.type === 'Series' 
                            ? r.name.toLowerCase() === rec.title.toLowerCase() 
                            : r.title.toLowerCase() === rec.title.toLowerCase()
                        )
                    ) || data.results.find((r: any) => r.media_type === searchType)
                    
                    if (match) {
                        cover_url = match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : undefined
                        author_or_studio = rec.type === 'Series' ? (match.first_air_date ? match.first_air_date.substring(0, 4) : '') : ''
                        notes = match.overview || notes
                    }
                }
            } catch (e) {
                console.error('Failed fetching TMDB details for recommendation:', e)
            }
        }

        try {
            await createDetailedMediaItem({
                title: rec.title,
                type: rec.type,
                status: 'Backlog',
                cover_url,
                author_or_studio,
                notes
            })
            alert(`"${rec.title}" se agregó a tu backlog pendiente!`)
            const updated = await fetchUpdatedItems()
            setItems(updated)
        } catch (e) {
            alert('Error agregando recomendación')
        } finally {
            setActionLoading(null)
        }
    }

    // Manual item creation
    async function handleAddManual(e: React.FormEvent) {
        e.preventDefault()
        if (!customTitle.trim()) return
        setActionLoading('manual')

        let initialProgress = ''
        if (customStatus === 'Active') {
            if (customType === 'Series') initialProgress = 'S1 Ep 1'
            else if (customType === 'Book') initialProgress = 'Pág 1'
            else if (customType === 'Game') initialProgress = '0%'
        }

        try {
            await createDetailedMediaItem({
                title: customTitle,
                type: customType,
                status: customStatus,
                author_or_studio: customAuthor || undefined,
                notes: customNotes || 'Cargado manualmente',
                rating: customStatus === 'Finished' ? customRating : null,
                progress: initialProgress
            })
            const updated = await fetchUpdatedItems()
            setItems(updated)
            setCustomTitle('')
            setCustomAuthor('')
            setCustomNotes('')
            setCustomStatus('Backlog')
            setCustomRating(8.0)
            setIsManualOpen(false)
        } catch (e) {
            alert('Error al guardar')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleStatusChange(id: string, newStatus: 'Backlog' | 'Active' | 'Finished') {
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

    // Stepper Trackers Parser/Helpers
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
        if (increment) newEpisode += 1
        else newEpisode = Math.max(1, episode - 1)

        const newProgress = `S${season} Ep ${newEpisode}`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    async function handleSeasonChange(item: MediaItem, increment: boolean) {
        const { season } = parseSeriesProgress(item.progress)
        let newSeason = season
        if (increment) newSeason += 1
        else newSeason = Math.max(1, season - 1)

        const newProgress = `S${newSeason} Ep 1`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    // Books Page Tracker Helper
    function parseBookProgress(progressStr: string) {
        const match = progressStr?.match(/Pág\s*(\d+)/i) || progressStr?.match(/Pag\s*(\d+)/i)
        if (match) return parseInt(match[1])
        const numeric = parseInt(progressStr)
        return isNaN(numeric) ? 1 : numeric
    }

    async function handleBookProgressChange(item: MediaItem, newPage: number) {
        const page = Math.max(1, newPage)
        const newProgress = `Pág ${page}`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    // Games Percent Tracker Helper
    function parseGameProgress(progressStr: string) {
        const match = progressStr?.match(/(\d+)%/i)
        if (match) return parseInt(match[1])
        const numeric = parseInt(progressStr)
        return isNaN(numeric) ? 0 : numeric
    }

    async function handleGameProgressChange(item: MediaItem, newPercent: number) {
        const pct = Math.min(100, Math.max(0, newPercent))
        const newProgress = `${pct}%`
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: newProgress } : i))
        await updateMediaProgress(item.id, newProgress)
    }

    async function handleSaveRating(rating: number) {
        if (!ratingItem) return
        setActionLoading(ratingItem.id)
        try {
            await updateMediaRating(ratingItem.id, rating)
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
            if (item.type !== 'Book' && item.type !== 'Game') return false
            if (othersTypeFilter !== 'All' && item.type !== othersTypeFilter) return false
            return item.status === othersStatusFilter
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
                        Centro multimedia de películas, series, lectura y videojuegos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2.5 rounded-xl border transition-colors ${showConfig ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'glass hover:bg-secondary'}`}
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
                    {filteredItems.length > 0 && activeTab !== 'Recommendations' && (
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
                    placeholder={hasTMDBCredential ? "Buscar películas o series en vivo por TMDB..." : "Configura tu API Key de TMDB para buscar carteleras reales..."}
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
                                    <div className="flex gap-1 shrink-0">
                                        <button
                                            disabled={actionLoading === res.id.toString()}
                                            onClick={() => handleAddTMDBItem(res, 'Backlog')}
                                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-[10px] font-semibold rounded-lg border border-border whitespace-nowrap"
                                        >
                                            + Pendiente
                                        </button>
                                        <button
                                            disabled={actionLoading === res.id.toString()}
                                            onClick={() => handleAddTMDBItem(res, 'Active')}
                                            className="px-2.5 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-[10px] font-semibold rounded-lg border border-pink-500/20 whitespace-nowrap"
                                        >
                                            ▶ Ver
                                        </button>
                                        <button
                                            disabled={actionLoading === res.id.toString()}
                                            onClick={() => setRatingTMDBItem(res)}
                                            className="px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-400 text-[10px] font-semibold rounded-lg border border-yellow-500/20 whitespace-nowrap"
                                        >
                                            ✓ Ya vista
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

            {/* Trending Carousels for Movie and Series */}
            {hasTMDBCredential && subFilter !== 'Finished' && !searchQuery && (
                <div>
                    {activeTab === 'Movies' && trendingMovies.length > 0 && (
                        <div className="space-y-3 pb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                                <h2 className="font-heading font-bold text-lg text-white">Películas de Tendencia</h2>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth snap-x">
                                {trendingMovies.map((movie, index) => {
                                    const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null
                                    const year = movie.release_date ? movie.release_date.substring(0, 4) : ''
                                    return (
                                        <div key={movie.id} className="snap-start shrink-0 relative w-36 group">
                                            {/* Large Transparent Ranking Number */}
                                            <div className="absolute -left-2 -bottom-2 text-8xl font-black text-white/10 select-none font-mono pointer-events-none group-hover:text-pink-500/20 transition-all z-10">
                                                {index + 1}
                                            </div>
                                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-lg group-hover:border-pink-500/30 transition-all bg-secondary/25">
                                                {poster ? (
                                                    <img src={poster} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Clapperboard className="w-8 h-8" /></div>
                                                )}
                                                <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2.5 space-y-1.5 z-20">
                                                    <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{movie.title}</p>
                                                    <div className="flex flex-col gap-1">
                                                        <button onClick={() => handleAddTMDBItem(movie, 'Backlog')} className="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-semibold border border-white/10">
                                                            + Pendiente
                                                        </button>
                                                        <button onClick={() => handleAddTMDBItem(movie, 'Active')} className="py-1 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[9px] font-bold">
                                                            ▶ Ver
                                                        </button>
                                                        <button onClick={() => setRatingTMDBItem(movie)} className="py-1 bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-300 rounded-lg text-[9px] font-semibold border border-yellow-500/20">
                                                            ✓ Ya vista
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Series' && trendingSeries.length > 0 && (
                        <div className="space-y-3 pb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                                <h2 className="font-heading font-bold text-lg text-white">Series de Tendencia</h2>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth snap-x">
                                {trendingSeries.map((series, index) => {
                                    const poster = series.poster_path ? `https://image.tmdb.org/t/p/w342${series.poster_path}` : null
                                    const year = series.first_air_date ? series.first_air_date.substring(0, 4) : ''
                                    return (
                                        <div key={series.id} className="snap-start shrink-0 relative w-36 group">
                                            {/* Large Transparent Ranking Number */}
                                            <div className="absolute -left-2 -bottom-2 text-8xl font-black text-white/10 select-none font-mono pointer-events-none group-hover:text-pink-500/20 transition-all z-10">
                                                {index + 1}
                                            </div>
                                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-lg group-hover:border-pink-500/30 transition-all bg-secondary/25">
                                                {poster ? (
                                                    <img src={poster} alt={series.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-8 h-8" /></div>
                                                )}
                                                <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-2.5 space-y-1.5 z-20">
                                                    <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{series.name}</p>
                                                    <div className="flex flex-col gap-1">
                                                        <button onClick={() => handleAddTMDBItem(series, 'Backlog')} className="py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-semibold border border-white/10">
                                                            + Pendiente
                                                        </button>
                                                        <button onClick={() => handleAddTMDBItem(series, 'Active')} className="py-1 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[9px] font-bold">
                                                            ▶ Ver
                                                        </button>
                                                        <button onClick={() => setRatingTMDBItem(series)} className="py-1 bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-300 rounded-lg text-[9px] font-semibold border border-yellow-500/20">
                                                            ✓ Ya vista
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

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

            {/* SubFilters for Others (Books & Games) */}
            {activeTab === 'Others' && (
                <div className="space-y-3">
                    {/* Types */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        {[
                            { id: 'All', label: 'Todos' },
                            { id: 'Book', label: 'Libros 📖' },
                            { id: 'Game', label: 'Juegos 🎮' }
                        ].map(typeF => (
                            <button
                                key={typeF.id}
                                onClick={() => setOthersTypeFilter(typeF.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    othersTypeFilter === typeF.id
                                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                }`}
                            >
                                {typeF.label}
                            </button>
                        ))}
                    </div>

                    {/* Status */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {[
                            { id: 'Backlog', label: 'Pendientes' },
                            { id: 'Active', label: 'Leyendo / Jugando' },
                            { id: 'Finished', label: 'Terminados' }
                        ].map(statusF => (
                            <button
                                key={statusF.id}
                                onClick={() => setOthersStatusFilter(statusF.id as any)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                    othersStatusFilter === statusF.id
                                        ? 'bg-pink-600/10 text-pink-400 border border-pink-500/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                }`}
                            >
                                {statusF.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Content Grid */}
            {activeTab === 'Recommendations' ? (
                /* Recommendations Layout */
                <div className="space-y-6">
                    {/* Toggle Recs Type */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setRecCategory('cine')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                recCategory === 'cine'
                                    ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                                    : 'border-white/5 hover:bg-secondary/40 text-muted-foreground'
                            }`}
                        >
                            🎥 Cine y TV
                        </button>
                        <button
                            onClick={() => setRecCategory('books_games')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                recCategory === 'books_games'
                                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                    : 'border-white/5 hover:bg-secondary/40 text-muted-foreground'
                            }`}
                        >
                            📖 Libros y Juegos
                        </button>
                    </div>

                    {loadingRecs ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                            <p className="text-sm">Analizando tu catálogo y generando recomendaciones personalizadas...</p>
                        </div>
                    ) : recsError ? (
                        <div className="glass p-8 text-center rounded-2xl border border-red-500/10 text-red-400 max-w-md mx-auto space-y-4">
                            <AlertCircle className="w-8 h-8 mx-auto" />
                            <p className="text-sm font-semibold">{recsError}</p>
                            <button onClick={() => loadRecommendations(recCategory)} className="px-4 py-2 bg-secondary rounded-lg text-xs hover:bg-secondary/80 text-foreground transition-all">Reintentar</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiRecommendations.map((rec, i) => (
                                <div key={i} className="glass p-5 rounded-2xl border border-border/50 hover:bg-secondary/15 transition-all flex items-start gap-4">
                                    <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl shrink-0 mt-0.5">
                                        {rec.type === 'Series' ? <Tv className="w-6 h-6" /> : 
                                         rec.type === 'Book' ? <Book className="w-6 h-6" /> :
                                         rec.type === 'Game' ? <Gamepad className="w-6 h-6" /> :
                                         <Clapperboard className="w-6 h-6" />}
                                    </div>
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <h3 className="font-heading font-bold text-lg text-white leading-snug">{rec.title}</h3>
                                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground border border-border capitalize">
                                            {rec.type === 'Series' ? 'Serie Recomendada' : 
                                             rec.type === 'Movie' ? 'Película Recomendada' :
                                             rec.type === 'Book' ? 'Libro Recomendado' : 'Videojuego Recomendado'}
                                        </span>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>
                                        
                                        <button
                                            onClick={() => handleAddRecommendation(rec, i)}
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
                                Tu lista está vacía. Busca o agrega títulos manualmente para empezar a llenar tu catálogo.
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map(item => {
                                const isSeries = item.type === 'Series'
                                const isMovie = item.type === 'Movie'
                                const isBook = item.type === 'Book'
                                const isGame = item.type === 'Game'
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
                                                    {isSeries ? <Tv className="w-7 h-7" /> : 
                                                     isBook ? <Book className="w-7 h-7" /> : 
                                                     isGame ? <Gamepad className="w-7 h-7" /> : 
                                                     <Clapperboard className="w-7 h-7" />}
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
                                                            {isSeries ? 'Viendo' : isMovie ? 'Viendo' : isBook ? 'Leyendo' : 'Jugando'}
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

                                        {/* Tracker for Active Books */}
                                        {isActive && isBook && (
                                            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Progreso de lectura:</span>
                                                    <span className="font-bold text-white bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">{item.progress}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1.5 bg-secondary/35 rounded-xl border border-border/50 px-2 py-0.5">
                                                        <button onClick={() => handleBookProgressChange(item, parseBookProgress(item.progress) - 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-5</button>
                                                        <button onClick={() => handleBookProgressChange(item, parseBookProgress(item.progress) - 1)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-1</button>
                                                        <span className="text-xs font-bold font-mono px-1 min-w-[20px] text-center">{parseBookProgress(item.progress)}</span>
                                                        <button onClick={() => handleBookProgressChange(item, parseBookProgress(item.progress) + 1)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+1</button>
                                                        <button onClick={() => handleBookProgressChange(item, parseBookProgress(item.progress) + 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+5</button>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const pStr = prompt("Ingresa la página actual:", parseBookProgress(item.progress).toString())
                                                            if (pStr !== null) {
                                                                const val = parseInt(pStr)
                                                                if (!isNaN(val)) handleBookProgressChange(item, val)
                                                            }
                                                        }}
                                                        className="p-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                                                    >
                                                        Editar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tracker for Active Games */}
                                        {isActive && isGame && (
                                            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Progreso de juego:</span>
                                                    <span className="font-bold text-white bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{item.progress}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1.5 bg-secondary/35 rounded-xl border border-border/50 px-2 py-0.5">
                                                        <button onClick={() => handleGameProgressChange(item, parseGameProgress(item.progress) - 10)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-10%</button>
                                                        <button onClick={() => handleGameProgressChange(item, parseGameProgress(item.progress) - 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">-5%</button>
                                                        <span className="text-xs font-bold font-mono px-1 min-w-[28px] text-center">{parseGameProgress(item.progress)}%</span>
                                                        <button onClick={() => handleGameProgressChange(item, parseGameProgress(item.progress) + 5)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+5%</button>
                                                        <button onClick={() => handleGameProgressChange(item, parseGameProgress(item.progress) + 10)} className="text-muted-foreground hover:text-white px-1 font-bold text-xs">+10%</button>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const pStr = prompt("Ingresa el porcentaje completado:", parseGameProgress(item.progress).toString())
                                                            if (pStr !== null) {
                                                                const val = parseInt(pStr)
                                                                if (!isNaN(val)) handleGameProgressChange(item, val)
                                                            }
                                                        }}
                                                        className="p-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                                                    >
                                                        Editar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom Action trigger */}
                                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3 text-xs">
                                            {isSeries && isActive ? (
                                                <button
                                                    onClick={() => setRatingItem(item)}
                                                    className="text-pink-400 font-semibold hover:underline flex items-center gap-1"
                                                >
                                                    Terminar Temporada {progress?.season}
                                                </button>
                                            ) : (
                                                <div className="text-muted-foreground font-medium">
                                                    {isFinished ? 'Finalizado ✓' : 'En tu Backlog'}
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

            {/* Rating Modal for normal status updates */}
            {ratingItem && (
                <RatingModal
                    title={ratingItem.title}
                    onClose={() => setRatingItem(null)}
                    onSubmit={handleSaveRating}
                />
            )}

            {/* Rating Modal for direct TMDB search results additions */}
            {ratingTMDBItem && (
                <RatingModal
                    title={ratingTMDBItem.media_type === 'movie' || ratingTMDBItem.title !== undefined ? ratingTMDBItem.title : ratingTMDBItem.name}
                    onClose={() => setRatingTMDBItem(null)}
                    onSubmit={handleAddTMDBItemWithRating}
                />
            )}

            {/* Manual item creation modal */}
            <AnimatePresence>
                {isManualOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1b26] border border-white/10 w-full max-w-md rounded-3xl p-6 relative flex flex-col gap-4 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <button onClick={() => setIsManualOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-muted-foreground"><X className="w-5 h-5" /></button>
                            <h2 className="text-xl font-bold font-heading">Carga Manual Completa</h2>
                            <form onSubmit={handleAddManual} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
                                        <select
                                            value={customType}
                                            onChange={(e) => setCustomType(e.target.value as any)}
                                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none"
                                        >
                                            <option value="Movie">Película 🎥</option>
                                            <option value="Series">Serie 📺</option>
                                            <option value="Book">Libro 📖</option>
                                            <option value="Game">Juego 🎮</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground">Estado</label>
                                        <select
                                            value={customStatus}
                                            onChange={(e) => setCustomStatus(e.target.value as any)}
                                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none"
                                        >
                                            <option value="Backlog">Pendiente</option>
                                            <option value="Active">En Progreso</option>
                                            <option value="Finished">Terminado</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Título</label>
                                    <input
                                        required
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        placeholder="Ej: El Hobbit, The Witcher..."
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Creador / Estudio / Autor</label>
                                    <input
                                        type="text"
                                        value={customAuthor}
                                        onChange={(e) => setCustomAuthor(e.target.value)}
                                        placeholder="Ej: J.R.R. Tolkien, Bethesda..."
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                                    />
                                </div>

                                {customStatus === 'Finished' && (
                                    <div className="space-y-2 bg-yellow-500/5 p-3 rounded-2xl border border-yellow-500/10">
                                        <div className="flex justify-between items-center text-xs font-bold text-yellow-400">
                                            <span>Calificación</span>
                                            <span>{customRating.toFixed(1)}/10</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1.0"
                                            max="10.0"
                                            step="0.1"
                                            value={customRating}
                                            onChange={(e) => setCustomRating(parseFloat(e.target.value))}
                                            className="w-full accent-yellow-500 cursor-pointer"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Notas / Sinopsis</label>
                                    <textarea
                                        value={customNotes}
                                        onChange={(e) => setCustomNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Cualquier nota o comentario personal..."
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-pink-500 resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={actionLoading === 'manual'}
                                    className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow shadow-pink-600/20"
                                >
                                    {actionLoading === 'manual' ? 'Guardando...' : 'Añadir al Catálogo'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
