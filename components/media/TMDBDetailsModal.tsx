'use client'

import { motion } from 'framer-motion'
import { X, Star, Calendar, Tv, Clapperboard, Plus, Play, Check, Globe } from 'lucide-react'

export function TMDBDetailsModal({
    item,
    onClose,
    onAdd
}: {
    item: any
    onClose: () => void
    onAdd: (status: 'Backlog' | 'Active' | 'Finished') => void
}) {
    const isMovie = item.media_type === 'movie' || (item.title !== undefined)
    const title = isMovie ? item.title : item.name
    const originalTitle = isMovie ? item.original_title : item.original_name
    const releaseDate = isMovie ? item.release_date : item.first_air_date
    const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A'
    
    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null
    const backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A'
    const voteCount = item.vote_count || 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#1a1b26] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
            >
                {/* Backdrop Image Banner */}
                {backdrop ? (
                    <div className="w-full h-48 relative shrink-0">
                        <img src={backdrop} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b26] via-[#1a1b26]/60 to-transparent" />
                    </div>
                ) : (
                    <div className="w-full h-12 bg-pink-600/10 shrink-0" />
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full transition-all text-white border border-white/10 hover:border-white/30 z-30"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Content body */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Poster */}
                        <div className="w-32 md:w-40 shrink-0 mx-auto md:mx-0">
                            {poster ? (
                                <img
                                    src={poster}
                                    alt={title}
                                    className="w-full aspect-[2/3] rounded-2xl object-cover shadow-2xl border border-white/10"
                                />
                            ) : (
                                <div className="w-full aspect-[2/3] rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-white/10 shadow-2xl">
                                    {isMovie ? <Clapperboard className="w-10 h-10" /> : <Tv className="w-10 h-10" />}
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 space-y-4 min-w-0 text-center md:text-left">
                            <div>
                                <h2 className="text-2xl font-heading font-extrabold text-white leading-tight">
                                    {title}
                                </h2>
                                {originalTitle && originalTitle !== title && (
                                    <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                                        Título Original: {originalTitle}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
                                {/* Type tag */}
                                <span className="bg-pink-600/20 text-pink-300 px-2.5 py-0.5 rounded-full border border-pink-500/20 font-bold uppercase tracking-wider text-[10px]">
                                    {isMovie ? 'Película' : 'Serie'}
                                </span>

                                {/* Date */}
                                <span className="flex items-center gap-1 text-muted-foreground">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {year}
                                </span>

                                {/* TMDB Rating */}
                                <span className="flex items-center gap-1 text-yellow-500 font-bold">
                                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                    {rating} <span className="text-[10px] text-muted-foreground font-normal">({voteCount} votos)</span>
                                </span>
                            </div>

                            {/* Synopsis */}
                            {item.overview ? (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sinopsis</h4>
                                    <p className="text-sm text-white/90 leading-relaxed text-justify md:text-left">
                                        {item.overview}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No hay descripción disponible para este título en español.</p>
                            )}

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-4 pt-2 text-xs border-t border-white/5">
                                {item.original_language && (
                                    <div>
                                        <p className="text-muted-foreground">Idioma original</p>
                                        <p className="font-semibold text-white flex items-center gap-1.5 justify-center md:justify-start mt-0.5 uppercase">
                                            <Globe className="w-3.5 h-3.5 text-indigo-400" />
                                            {item.original_language}
                                        </p>
                                    </div>
                                )}
                                {item.vote_average && (
                                    <div>
                                        <p className="text-muted-foreground">Puntuación Popular</p>
                                        <p className="font-semibold text-white mt-0.5">
                                            {item.vote_average} / 10
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t border-white/5 flex flex-col sm:flex-row gap-3 bg-black/10 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-all text-center"
                    >
                        Cerrar
                    </button>
                    
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 justify-end">
                        <button
                            onClick={() => onAdd('Backlog')}
                            className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-xl border border-border flex items-center justify-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            + Pendiente
                        </button>
                        
                        <button
                            onClick={() => onAdd('Active')}
                            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow shadow-pink-600/25"
                        >
                            <Play className="w-4 h-4" />
                            ▶ Ver Ahora
                        </button>
                        
                        <button
                            onClick={() => onAdd('Finished')}
                            className="px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold rounded-xl border border-yellow-500/20 flex items-center justify-center gap-1.5"
                        >
                            <Check className="w-4 h-4" />
                            ✓ Ya Vista
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
