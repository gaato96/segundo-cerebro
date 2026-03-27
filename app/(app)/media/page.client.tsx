'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Library, Plus, Tv, Book, Gamepad, Clapperboard, Check, Trash2, X, Loader2, Play, CircleDot } from 'lucide-react'
import { createMediaItem, updateMediaStatus, updateMediaProgress, deleteMediaItem } from '@/lib/actions/media'

export function MediaClient({ initialItems }: { initialItems: any[] }) {
    const [items, setItems] = useState(initialItems)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const [filterType, setFilterType] = useState<string>('All') // All, Movie, Series, Book, Game
    const [filterStatus, setFilterStatus] = useState<string>('Active') // All, Backlog, Active, Finished

    const filteredItems = items.filter(item => {
        if (filterType !== 'All' && item.type !== filterType) return false
        if (filterStatus !== 'All' && item.status !== filterStatus) return false
        return true
    })

    // Groupings for Active display if "All" is selected
    const activeItems = items.filter(i => i.status === 'Active')

    async function handleStatusChange(id: string, newStatus: string) {
        setLoading(id)
        try {
            // Optimistic
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
            await updateMediaStatus(id, newStatus)
        } catch (error) {
            alert('Error cambiando estado')
            // Revert optimism by reloading ideally, omitting for brevity
        } finally {
            setLoading(null)
        }
    }

    async function handleProgressChange(id: string, progress: string) {
        setLoading(id)
        try {
            setItems(prev => prev.map(i => i.id === id ? { ...i, progress } : i))
            await updateMediaProgress(id, progress)
        } catch (error) {
            alert('Error actualizando progreso')
        } finally {
            setLoading(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar esto?')) return
        setLoading(id)
        try {
            await deleteMediaItem(id)
            setItems(prev => prev.filter(i => i.id !== id))
        } catch (error) {
            alert('Error eliminando')
        } finally {
            setLoading(null)
        }
    }

    const getTypeIcon = (type: string, className = "w-4 h-4") => {
        switch (type) {
            case 'Movie': return <Clapperboard className={className} />
            case 'Series': return <Tv className={className} />
            case 'Book': return <Book className={className} />
            case 'Game': return <Gamepad className={className} />
            default: return <Library className={className} />
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Movie': return 'text-purple-400 bg-purple-500/10'
            case 'Series': return 'text-blue-400 bg-blue-500/10'
            case 'Book': return 'text-amber-400 bg-amber-500/10'
            case 'Game': return 'text-emerald-400 bg-emerald-500/10'
            default: return 'text-muted-foreground bg-secondary'
        }
    }

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
                        Backlog de películas, series, libros y juegos.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Añadir al Backlog
                </button>
            </div>

            {/* Tabs / Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-secondary/30 p-2 rounded-2xl border border-border/50">
                <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
                    {['All', 'Active', 'Backlog', 'Finished'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === status
                                ? 'bg-background text-foreground shadow-sm border border-border'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
                                }`}
                        >
                            {status === 'All' ? 'Todo' : status === 'Active' ? 'Viendo / Jugando' : status === 'Backlog' ? 'Pendiente' : 'Terminado'}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full md:w-[150px] bg-background border border-border rounded-xl px-4 py-2 flex-1 text-sm focus:ring-2 focus:ring-pink-500 appearance-none"
                    >
                        <option value="All">Todo los tipos</option>
                        <option value="Movie">Películas</option>
                        <option value="Series">Series</option>
                        <option value="Book">Libros</option>
                        <option value="Game">Juegos</option>
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.length === 0 ? (
                    <div className="col-span-full glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-4">
                            <Library className="w-8 h-8 text-pink-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">No hay contenido acá</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Tu lista de entretenimiento está vacía con estos filtros.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map(item => (
                            <motion.div
                                layout
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`glass p-5 rounded-2xl border transition-all group relative ${item.status === 'Finished'
                                    ? 'border-border/30 bg-secondary/10 opacity-70 hover:opacity-100'
                                    : 'border-border/50 hover:bg-secondary/20'
                                    }`}
                            >
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 rounded-md hover:bg-red-500/10 transition-all z-10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                <div className="flex items-start gap-4 pr-8">
                                    <div className={`p-3 rounded-xl shrink-0 ${getTypeColor(item.type)}`}>
                                        {getTypeIcon(item.type, "w-6 h-6")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold text-lg truncate ${item.status === 'Finished' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                                {item.type === 'Movie' ? 'Película' : item.type === 'Series' ? 'Serie' : item.type === 'Book' ? 'Libro' : 'Juego'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress / Actions */}
                                <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between gap-3">
                                    {item.status === 'Active' ? (
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={item.progress || ''}
                                                onChange={(e) => handleProgressChange(item.id, e.target.value)}
                                                placeholder={item.type === 'Series' ? 'Ep 4' : item.type === 'Book' ? 'Pág 120' : 'Progreso...'}
                                                className="w-full bg-background border border-border py-1.5 px-3 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-pink-500 outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex-1 text-sm text-muted-foreground">
                                            {item.status === 'Finished' ? 'Terminado' : 'En Backlog'}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 shrink-0">
                                        {item.status !== 'Active' && item.status !== 'Finished' && (
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'Active')}
                                                className="p-1.5 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors tooltip"
                                                title="Empezar a ver/jugar/leer"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}

                                        {item.status === 'Active' && (
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'Finished')}
                                                className="p-1.5 text-blue-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                                                title="Marcar como Terminado"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}

                                        {item.status === 'Finished' && (
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'Active')}
                                                className="p-1.5 text-green-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Volver a Activo"
                                            >
                                                <CircleDot className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Añadir al Backlog</h2>
                                <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>

                            <form action={async (formData) => {
                                setLoading('create')
                                try {
                                    await createMediaItem(formData)
                                    // Full reload to get the new item with ID (optimistic approach skipped for brevity on list updates)
                                    window.location.reload()
                                } catch (e) {
                                    alert('Error al guardar')
                                    setLoading(null)
                                }
                            }} className="p-6 space-y-4 overflow-y-auto flex-1">

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select name="type" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 appearance-none">
                                        <option value="Movie">Película</option>
                                        <option value="Series">Serie</option>
                                        <option value="Book">Libro</option>
                                        <option value="Game">Videojuego</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Título</label>
                                    <input required autoFocus name="title" placeholder="Ej. The Last of Us, Dune..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Estado inicial</label>
                                    <select name="status" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 appearance-none text-muted-foreground">
                                        <option value="Backlog">Pendiente (Backlog)</option>
                                        <option value="Active">Empezar ahora</option>
                                    </select>
                                </div>

                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'create'} type="submit" className="bg-pink-600 hover:bg-pink-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Añadir'}
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
