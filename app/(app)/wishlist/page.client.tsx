'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Plus, Trash2, X, Loader2, ExternalLink, Star, CheckCircle2, Circle } from 'lucide-react'
import { createWish, deleteWish, toggleWishPurchased } from '@/lib/actions/wishlist'

export function WishlistClient({ items }: { items: any[] }) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const pendingItems = items.filter(i => !i.purchased)
    const purchasedItems = items.filter(i => i.purchased)

    const pendingCost = pendingItems.reduce((acc, i) => acc + (i.price || 0), 0)
    const purchasedCost = purchasedItems.reduce((acc, i) => acc + (i.price || 0), 0)

    const formatCurrency = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

    async function handleTogglePurchased(id: string, current: boolean) {
        setLoading(id)
        try {
            await toggleWishPurchased(id, !current)
        } catch {
            alert('Error al actualizar')
        } finally {
            setLoading(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este deseo?')) return
        setLoading(id)
        try { await deleteWish(id) } catch { alert('Error') } finally { setLoading(null) }
    }

    const desireStars = (level: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < level ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
        ))
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Wishlist
                        <Heart className="w-6 h-6 text-rose-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Todo lo que soñás tener. Priorizá tus deseos.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Deseo
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass p-5 rounded-2xl border border-border/50 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Pendiente de compra</p>
                        <p className="text-2xl font-bold text-rose-400">{formatCurrency(pendingCost)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Items</p>
                        <p className="text-2xl font-bold">{pendingItems.length}</p>
                    </div>
                </div>
                <div className="glass p-5 rounded-2xl border border-border/50 flex items-center justify-between bg-emerald-500/5">
                    <div>
                        <p className="text-sm text-muted-foreground">Ya invertido</p>
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(purchasedCost)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Cumplidos</p>
                        <p className="text-2xl font-bold text-emerald-400">{purchasedItems.length}</p>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.length === 0 ? (
                    <div className="col-span-full glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
                            <Heart className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">Sin deseos</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Agregá las cosas que te gustaría comprar o tener.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {items.map(item => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="glass p-5 rounded-2xl border border-border/50 group relative hover:bg-secondary/20 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <h3 className={`font-semibold text-lg pr-8 ${item.purchased ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.name}
                                    </h3>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleTogglePurchased(item.id, item.purchased)}
                                            disabled={loading === item.id}
                                            className={`p-1.5 transition-colors rounded-lg hover:bg-secondary ${item.purchased ? 'text-emerald-500' : 'text-muted-foreground hover:text-rose-400'}`}
                                        >
                                            {loading === item.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : item.purchased ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : (
                                                <Circle className="w-5 h-5" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                        {item.category}
                                    </span>
                                    {item.url && (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                            <ExternalLink className="w-3 h-3" /> Link
                                        </a>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                                    <div className="flex items-center gap-0.5">
                                        {desireStars(item.desire_level)}
                                    </div>
                                    <span className={`font-bold text-lg ${item.purchased ? 'text-muted-foreground' : 'text-rose-400'}`}>
                                        {item.price > 0 ? formatCurrency(item.price) : 'Sin precio'}
                                    </span>
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
                                <h2 className="text-xl font-bold font-heading">Nuevo Deseo</h2>
                                <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={async (formData) => {
                                setLoading('create')
                                try { await createWish(formData); setIsFormOpen(false) }
                                catch { alert('Error') }
                                finally { setLoading(null) }
                            }} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">¿Qué deseás?</label>
                                    <input required autoFocus name="name" placeholder="Ej. iPhone 16, Viaje a Japón..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Precio ($)</label>
                                        <input type="number" step="0.01" name="price" placeholder="0" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">¿Cuánto lo querés? (1-5)</label>
                                        <select name="desire_level" defaultValue="3" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 appearance-none">
                                            <option value="1">1 — Meh</option>
                                            <option value="2">2 — Estaría bien</option>
                                            <option value="3">3 — Lo quiero</option>
                                            <option value="4">4 — Lo necesito</option>
                                            <option value="5">5 — ¡YA!</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Categoría</label>
                                    <select name="category" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 appearance-none">
                                        <option value="Tech">Tecnología</option>
                                        <option value="Travel">Viajes</option>
                                        <option value="Home">Hogar</option>
                                        <option value="Fashion">Ropa/Moda</option>
                                        <option value="Experience">Experiencias</option>
                                        <option value="General">General</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Link (opcional)</label>
                                    <input name="url" type="url" placeholder="https://..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'create'} type="submit" className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    )
}
