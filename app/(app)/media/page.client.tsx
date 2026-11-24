'use client'

import { useState, useEffect } from 'react'
import { Plus, Tv, Gamepad, Clapperboard, Check, Trash2, Loader2, Play, Search, Sparkles, Star, Dices, Settings } from 'lucide-react'
import { createDetailedMediaItem, updateMediaStatus, updateMediaProgress, updateMediaRating, deleteMediaItem, getAIMediaRecommendations, getMediaBacklog } from '@/lib/actions/media'
import { TMDBConfigCard } from '@/components/media/TMDBConfigCard'
import { MediaRouletteModal } from '@/components/media/MediaRouletteModal'
import { RatingModal } from '@/components/media/RatingModal'
import { TMDBDetailsModal } from '@/components/media/TMDBDetailsModal'
import { FootballHub } from '@/components/media/FootballHub'
import { GameLibrary } from '@/components/media/GameLibrary'
import { PageShell, PageHeader, SectionLabel, EmptyState } from '@/components/ui/kit'
import { Modal, Field, Segmented } from '@/components/ui/controls'
import { cn } from '@/lib/utils'

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
    const [activeTab, setActiveTab] = useState<'Movies' | 'Series' | 'Games' | 'Recommendations'>('Series')
    const [gamesSubTab, setGamesSubTab] = useState<'Football' | 'Library'>('Football')
    const [subFilter, setSubFilter] = useState<'Backlog' | 'Active' | 'Finished'>('Backlog')
    

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
    const [ratingRecItem, setRatingRecItem] = useState<{ rec: any; idx: number } | null>(null)
    const [selectedSearchItem, setSelectedSearchItem] = useState<any | null>(null)
    
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

    useEffect(() => { setItems(initialItems) }, [initialItems])

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

    async function fetchUpdatedItems(): Promise<any> {
        return await getMediaBacklog()
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

    // Add recommended item as Finished ("Ya la vi") - fetches TMDB metadata then opens rating modal
    async function handleAddRecAsFinished(rec: any, idx: number) {
        setActionLoading(`rec-seen-${idx}`)
        const apiKey = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY
        let enrichedRec = { ...rec }

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
                            ? r.name?.toLowerCase() === rec.title.toLowerCase()
                            : r.title?.toLowerCase() === rec.title.toLowerCase()
                        )
                    ) || data.results.find((r: any) => r.media_type === searchType)

                    if (match) {
                        enrichedRec.poster_path = match.poster_path
                        enrichedRec.overview = match.overview || rec.reason
                        enrichedRec.first_air_date = match.first_air_date
                        enrichedRec.release_date = match.release_date
                        enrichedRec.tmdb_id = match.id
                    }
                }
            } catch (e) {
                console.error('Failed fetching TMDB details for rec rating:', e)
            }
        }

        setActionLoading(null)
        setRatingRecItem({ rec: enrichedRec, idx })
    }

    // Submit rating for a recommended item (marks it as Finished)
    async function handleSubmitRecRating(rating: number) {
        if (!ratingRecItem) return
        const { rec } = ratingRecItem
        const cover_url = rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : undefined
        const notes = rec.overview || rec.reason || 'Recomendado por IA'
        const author_or_studio = rec.first_air_date ? rec.first_air_date.substring(0, 4)
            : rec.release_date ? rec.release_date.substring(0, 4) : ''

        setActionLoading(`rec-seen-submit`)
        try {
            await createDetailedMediaItem({
                title: rec.title,
                type: rec.type,
                status: 'Finished',
                cover_url,
                author_or_studio,
                notes,
                rating
            })
            const updated = await fetchUpdatedItems()
            setItems(updated)
            setRatingRecItem(null)
        } catch (e) {
            alert('Error al guardar el elemento calificado.')
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

    const hasTMDBCredential = tmdbApiKey || process.env.NEXT_PUBLIC_TMDB_API_KEY

    const kind = activeTab === 'Series' ? 'Series' : 'Movie'
    const mine = items.filter(i => i.type === kind)
    const playing = mine.filter(i => i.status === 'Active')
    const nf = (t: string) => items.filter(i => i.type === t).length
    const trending = activeTab === 'Series' ? trendingSeries : trendingMovies
    const backlog = mine.filter(i => i.status === 'Backlog')

    return (
        <PageShell wide>
            <PageHeader label="Vida · tiempo libre" title="Entretenimiento" subtitle="Lo que estás viendo, lo que querés ver y lo que jugás."
                actions={<>
                    <button onClick={() => setShowConfig(!showConfig)} aria-label="Configurar buscador" className="btn-secondary !px-3"><Settings className="w-4 h-4" /></button>
                    {(activeTab === 'Movies' || activeTab === 'Series') && backlog.length > 0 && <button onClick={() => setRouletteOpen(true)} className="btn-secondary text-sm"><Dices className="w-4 h-4" /> ¿Qué veo hoy?</button>}
                    <button onClick={() => setIsManualOpen(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Título</button>
                </>} />
            {showConfig && <div className="mb-6"><TMDBConfigCard /></div>}
            <div className="flex flex-wrap gap-3 mb-8">
                <Segmented value={activeTab} onChange={setActiveTab} options={[{ id: 'Movies', label: 'Películas', count: nf('Movie'), icon: Clapperboard }, { id: 'Series', label: 'Series', count: nf('Series'), icon: Tv }, { id: 'Games', label: 'Juegos y fútbol', icon: Gamepad }, { id: 'Recommendations', label: 'Para vos', icon: Sparkles }]} />
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input value={searchQuery} onChange={e => handleSearch(e.target.value)} disabled={!hasTMDBCredential} placeholder={hasTMDBCredential ? 'Buscar película o serie para sumar' : 'Cargá tu clave de TMDB con el engranaje para buscar'} aria-label="Buscar título" className="field pl-10" />
                    {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    {searchQuery && searchResults.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-2 rounded-2xl bg-popover border border-hairline shadow-2xl max-h-[60vh] overflow-y-auto divide-y divide-hairline">
                            {searchResults.slice(0, 8).map(r => <button key={r.id} onClick={() => setSelectedSearchItem(r)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-raised">{r.poster_path ? <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} alt="" className="w-9 aspect-[2/3] object-cover rounded-md" /> : <span className="w-9 aspect-[2/3] rounded-md bg-raised" />}<span className="min-w-0"><span className="block text-sm truncate">{r.title || r.name}</span><span className="block font-mono text-[11px] text-muted-foreground">{r.media_type === 'tv' ? 'serie' : 'película'} · {(r.release_date || r.first_air_date || '').slice(0, 4)}</span></span></button>)}
                        </div>
                    )}
                </div>
            </div>

            {(activeTab === 'Movies' || activeTab === 'Series') && (
                <div className="space-y-10">
                    {playing.length > 0 && (
                        <section>
                            <SectionLabel right={playing.length}>En curso</SectionLabel>
                            <div className="grid md:grid-cols-2 gap-4">
                                {playing.map((i, n) => {
                                    const pr = parseSeriesProgress(i.progress)
                                    return (
                                        <article key={i.id} className={cn('rounded-2xl p-4 flex gap-4', n === 0 ? 'lamp' : 'bg-card border border-hairline')}>
                                            <Poster item={i} className="w-24 shrink-0" />
                                            <div className="flex-1 min-w-0 flex flex-col">
                                                <p className="font-semibold leading-snug">{i.title}</p>
                                                {i.author_or_studio && <p className="text-xs text-muted-foreground mt-0.5">{i.author_or_studio}</p>}
                                                {i.type === 'Series' && <div className="flex flex-wrap gap-4 mt-3">{([['Temp.', pr.season, handleSeasonChange], ['Cap.', pr.episode, handleEpisodeChange]] as [string, number, (x: MediaItem, up: boolean) => void][]).map(([l, v, fn]) => <div key={l} className="flex items-center gap-1 text-xs text-muted-foreground">{l}<button onClick={() => fn(i, false)} aria-label={`${l} anterior`} className="w-8 h-8 rounded-lg hover:bg-raised">−</button><span className="font-mono text-foreground text-sm w-5 text-center">{v}</span><button onClick={() => fn(i, true)} aria-label={`${l} siguiente`} className="w-8 h-8 rounded-lg hover:bg-raised">+</button></div>)}</div>}
                                                <div className="flex gap-2 mt-auto pt-3"><button disabled={actionLoading === i.id} onClick={() => handleStatusChange(i.id, 'Finished')} className="btn-secondary !min-h-9 text-xs"><Check className="w-4 h-4" /> Vista</button><button onClick={() => handleStatusChange(i.id, 'Backlog')} className="text-xs text-muted-foreground hover:text-foreground px-2">Pausar</button></div>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        </section>
                    )}
                    <section>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="label-caps">Catálogo</h2><Segmented value={subFilter === 'Active' ? 'Backlog' : subFilter} onChange={v => setSubFilter(v)} options={[{ id: 'Backlog', label: 'Pendientes', count: backlog.length }, { id: 'Finished', label: 'Vistas', count: mine.filter(i => i.status === 'Finished').length }]} /></div>
                        {mine.filter(i => i.status === (subFilter === 'Active' ? 'Backlog' : subFilter)).length === 0 ? <EmptyState icon={Clapperboard} title="Nada por acá" hint="Buscá un título arriba o cargalo a mano." /> : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
                                {mine.filter(i => i.status === (subFilter === 'Active' ? 'Backlog' : subFilter)).map(i => (
                                    <article key={i.id} className="min-w-0">
                                        <Poster item={i} />
                                        <p className="text-sm font-medium leading-snug mt-2 line-clamp-2">{i.title}</p>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><span className="flex-1 truncate">{i.author_or_studio}</span>{i.rating != null && <span className="font-mono text-foreground inline-flex items-center gap-1"><Star className="w-3 h-3" />{Number(i.rating).toFixed(1)}</span>}</div>
                                        <div className="flex items-center -ml-2 mt-1">{i.status === 'Backlog' ? <button disabled={actionLoading === i.id} onClick={() => handleStatusChange(i.id, 'Active')} className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Empezar</button> : <button onClick={() => setRatingItem(i)} className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground">Calificar</button>}<button onClick={() => handleDelete(i.id)} aria-label={`Eliminar ${i.title}`} className="w-9 h-9 ml-auto text-ink-faint hover:text-red-300 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button></div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                    {trending.length > 0 && <section><SectionLabel>Tendencias de la semana</SectionLabel><div className="flex gap-4 overflow-x-auto pb-3">{trending.map(t => <button key={t.id} onClick={() => setSelectedSearchItem({ ...t, media_type: activeTab === 'Series' ? 'tv' : 'movie' })} className="w-28 shrink-0 text-left">{t.poster_path ? <img src={`https://image.tmdb.org/t/p/w342${t.poster_path}`} alt="" loading="lazy" className="w-full aspect-[2/3] object-cover rounded-xl border border-hairline" /> : <span className="block aspect-[2/3] rounded-xl bg-raised" />}<span className="block text-xs mt-1.5 line-clamp-2">{t.title || t.name}</span></button>)}</div></section>}
                </div>
            )}

            {activeTab === 'Games' && <div className="space-y-6"><Segmented value={gamesSubTab} onChange={setGamesSubTab} options={[{ id: 'Football', label: 'Fútbol y desafíos' }, { id: 'Library', label: 'Biblioteca de juegos', count: nf('Game') }]} />{gamesSubTab === 'Football' ? <FootballHub /> : <GameLibrary items={items} onRefresh={async () => setItems(await getMediaBacklog() as any)} />}</div>}

            {activeTab === 'Recommendations' && (
                <div className="max-w-[820px]">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><Segmented value={recCategory} onChange={setRecCategory} options={[{ id: 'cine', label: 'Cine y series' }, { id: 'books_games', label: 'Libros y juegos' }]} /><button onClick={() => loadRecommendations(recCategory)} disabled={loadingRecs} className="btn-secondary text-sm">{loadingRecs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Otras</button></div>
                    {recsError && <p className="text-sm text-red-300 mb-4">{recsError}</p>}
                    {loadingRecs ? <div className="space-y-3 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-card border border-hairline" />)}</div> : <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline">{aiRecommendations.map((r, n) => <article key={n} className="p-5 flex flex-col sm:flex-row gap-4"><div className="flex-1"><p className="label-caps !text-[10px]">{({ Movie: 'Película', Series: 'Serie', Book: 'Libro', Game: 'Juego' } as any)[r.type] || r.type}</p><h3 className="font-semibold mt-1">{r.title}</h3><p className="text-sm text-muted-foreground mt-1 max-w-[60ch]">{r.reason}</p></div><div className="flex sm:flex-col gap-2"><button disabled={!!actionLoading} onClick={() => handleAddRecommendation(r, n)} className="btn-secondary text-xs"><Plus className="w-4 h-4" /> Pendiente</button><button disabled={!!actionLoading} onClick={() => handleAddRecAsFinished(r, n)} className="text-xs text-muted-foreground hover:text-foreground min-h-[36px]">Ya la conozco</button></div></article>)}</div>}
                </div>
            )}

            {rouletteOpen && <MediaRouletteModal items={backlog} onClose={() => setRouletteOpen(false)} onStartItem={async id => { await handleStatusChange(id, 'Active'); setRouletteOpen(false) }} />}
            {ratingItem && <RatingModal title={ratingItem.title} onClose={() => setRatingItem(null)} onSubmit={handleSaveRating} />}
            {ratingTMDBItem && <RatingModal title={ratingTMDBItem.title || ratingTMDBItem.name} onClose={() => setRatingTMDBItem(null)} onSubmit={handleAddTMDBItemWithRating} />}
            {ratingRecItem && <RatingModal title={ratingRecItem.rec.title} onClose={() => setRatingRecItem(null)} onSubmit={handleSubmitRecRating} />}
            {selectedSearchItem && <TMDBDetailsModal item={selectedSearchItem} onClose={() => setSelectedSearchItem(null)} onAdd={async status => { if (status === 'Finished') { setRatingTMDBItem(selectedSearchItem); setSelectedSearchItem(null); return } await handleAddTMDBItem(selectedSearchItem, status); setSelectedSearchItem(null) }} />}
            <Modal open={isManualOpen} title="Agregar título" onClose={() => setIsManualOpen(false)}>
                <form onSubmit={handleAddManual} className="space-y-4">
                    <Field label="Título"><input required autoFocus value={customTitle} onChange={e => setCustomTitle(e.target.value)} className="field" /></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="Tipo"><select value={customType} onChange={e => setCustomType(e.target.value as any)} className="field"><option value="Movie">Película</option><option value="Series">Serie</option><option value="Book">Libro</option><option value="Game">Juego</option></select></Field><Field label="Estado"><select value={customStatus} onChange={e => setCustomStatus(e.target.value as any)} className="field"><option value="Backlog">Pendiente</option><option value="Active">En curso</option><option value="Finished">Terminado</option></select></Field></div>
                    {customStatus === 'Finished' && <Field label={`Nota: ${customRating}`}><input type="range" min="1" max="10" step="0.5" value={customRating} onChange={e => setCustomRating(Number(e.target.value))} className="w-full accent-amber-400" /></Field>}
                    <Field label="Autor, estudio o año"><input value={customAuthor} onChange={e => setCustomAuthor(e.target.value)} className="field" /></Field>
                    <Field label="Notas"><textarea rows={2} value={customNotes} onChange={e => setCustomNotes(e.target.value)} className="field py-2.5 resize-none" /></Field>
                    <button disabled={actionLoading === 'manual'} className="btn-primary w-full text-sm">Guardar</button>
                </form>
            </Modal>
        </PageShell>
    )
}

function Poster({ item, className }: { item: MediaItem; className?: string }) {
    return <div className={cn('aspect-[2/3] rounded-xl overflow-hidden border border-hairline bg-raised', className)}>{item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="w-full h-full p-3 flex items-center justify-center text-center text-sm font-medium">{item.title}</span>}</div>
}
