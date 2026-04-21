'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Heart, Plus, Trash2, X, Loader2, ExternalLink, Star,
    CheckCircle2, Circle, List, Pencil, MoreHorizontal, FolderPlus
} from 'lucide-react'
import {
    createWish, deleteWish, toggleWishPurchased,
    createWishlistList, updateWishlistList, deleteWishlistList
} from '@/lib/actions/wishlist'

type WishItem = {
    id: string
    name: string
    price: number
    url?: string
    category: string
    desire_level: number
    purchased: boolean
    list_id: string | null
    [key: string]: unknown
}

type WishList = {
    id: string
    name: string
    icon: string
    position: number
    [key: string]: unknown
}

const EMOJI_OPTIONS = ['📋', '🛒', '🏠', '👶', '💼', '🎮', '✈️', '👗', '💡', '🎁', '❤️', '🔧', '📱', '🎯', '🌟', '🍔']

export function WishlistClient({ items, lists }: { items: WishItem[]; lists: WishList[] }) {
    const [activeList, setActiveList] = useState<string | null>(null) // null = "Todas"
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isListFormOpen, setIsListFormOpen] = useState(false)
    const [editingList, setEditingList] = useState<WishList | null>(null)
    const [listMenuOpen, setListMenuOpen] = useState<string | null>(null)
    const [loading, setLoading] = useState<string | null>(null)

    // Filter items by selected list
    const filteredItems = activeList === null
        ? items // "Todas" — show everything
        : activeList === 'general'
            ? items.filter(i => !i.list_id)
            : items.filter(i => i.list_id === activeList)

    const pendingItems = filteredItems.filter(i => !i.purchased)
    const purchasedItems = filteredItems.filter(i => i.purchased)
    const pendingCost = pendingItems.reduce((acc, i) => acc + (i.price || 0), 0)
    const purchasedCost = purchasedItems.reduce((acc, i) => acc + (i.price || 0), 0)

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

    // Count items per list
    const getListCount = (listId: string | null) => {
        if (listId === null) return items.length
        if (listId === 'general') return items.filter(i => !i.list_id).length
        return items.filter(i => i.list_id === listId).length
    }

    async function handleTogglePurchased(id: string, current: boolean) {
        setLoading(id)
        try { await toggleWishPurchased(id, !current) }
        catch { alert('Error al actualizar') }
        finally { setLoading(null) }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este deseo?')) return
        setLoading(id)
        try { await deleteWish(id) } catch { alert('Error') } finally { setLoading(null) }
    }

    async function handleDeleteList(listId: string) {
        const listName = lists.find(l => l.id === listId)?.name
        if (!confirm(`¿Eliminar la lista "${listName}"? Se borrarán todos sus ítems.`)) return
        setLoading('delete-list')
        try {
            await deleteWishlistList(listId)
            if (activeList === listId) setActiveList(null)
        } catch { alert('Error al eliminar') }
        finally { setLoading(null); setListMenuOpen(null) }
    }

    const desireStars = (level: number) =>
        Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < level ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
        ))

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
                        Todo lo que soñás tener. Organizá por listas.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setEditingList(null); setIsListFormOpen(true) }}
                        className="border border-border hover:bg-secondary text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <FolderPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nueva Lista</span>
                    </button>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Deseo
                    </button>
                </div>
            </div>

            {/* List Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {/* "Todas" tab */}
                <button
                    onClick={() => setActiveList(null)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${activeList === null
                        ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/25'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                >
                    <List className="w-4 h-4" />
                    Todas
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeList === null ? 'bg-white/20' : 'bg-muted'}`}>
                        {getListCount(null)}
                    </span>
                </button>

                {/* "General" tab — items without a list */}
                <button
                    onClick={() => setActiveList('general')}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${activeList === 'general'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/25'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                >
                    <span>📌</span>
                    General
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeList === 'general' ? 'bg-white/20' : 'bg-muted'}`}>
                        {getListCount('general')}
                    </span>
                </button>

                {/* User lists */}
                {lists.map(list => (
                    <div key={list.id} className="relative shrink-0">
                        <button
                            onClick={() => setActiveList(list.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${activeList === list.id
                                ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/25'
                                : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                        >
                            <span>{list.icon}</span>
                            {list.name}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeList === list.id ? 'bg-white/20' : 'bg-muted'}`}>
                                {getListCount(list.id)}
                            </span>
                        </button>

                        {/* Menu button overlaid */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setListMenuOpen(listMenuOpen === list.id ? null : list.id) }}
                            className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${activeList === list.id
                                ? 'bg-white/20 text-white hover:bg-white/30'
                                : 'bg-muted text-muted-foreground hover:bg-border opacity-0 group-hover:opacity-100'
                                } hover:opacity-100`}
                            style={{ opacity: listMenuOpen === list.id ? 1 : undefined }}
                        >
                            <MoreHorizontal className="w-3 h-3" />
                        </button>

                        {/* Dropdown menu */}
                        <AnimatePresence>
                            {listMenuOpen === list.id && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-30 min-w-[140px] overflow-hidden"
                                >
                                    <button
                                        onClick={() => { setEditingList(list); setIsListFormOpen(true); setListMenuOpen(null) }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button
                                        onClick={() => handleDeleteList(list.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
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
                {filteredItems.length === 0 ? (
                    <div className="col-span-full glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
                            <Heart className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">
                            {activeList ? 'Sin deseos en esta lista' : 'Sin deseos'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            {activeList
                                ? 'Agregá ítems usando el botón "Nuevo Deseo".'
                                : 'Agregá las cosas que te gustaría comprar o tener.'}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map(item => {
                            const itemList = lists.find(l => l.id === item.list_id)
                            return (
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

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                            {item.category}
                                        </span>
                                        {itemList && activeList === null && (
                                            <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
                                                {itemList.icon} {itemList.name}
                                            </span>
                                        )}
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
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Click-away to close list menus */}
            {listMenuOpen && (
                <div className="fixed inset-0 z-20" onClick={() => setListMenuOpen(null)} />
            )}

            {/* ============ CREATE / EDIT LIST MODAL ============ */}
            <AnimatePresence>
                {isListFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsListFormOpen(false); setEditingList(null) }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">
                                    {editingList ? 'Editar Lista' : 'Nueva Lista'}
                                </h2>
                                <button onClick={() => { setIsListFormOpen(false); setEditingList(null) }} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form action={async (formData) => {
                                setLoading('list-form')
                                try {
                                    if (editingList) {
                                        await updateWishlistList(editingList.id, formData)
                                    } else {
                                        await createWishlistList(formData)
                                    }
                                    setIsListFormOpen(false)
                                    setEditingList(null)
                                } catch { alert('Error') }
                                finally { setLoading(null) }
                            }} className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nombre de la lista</label>
                                    <input
                                        required
                                        autoFocus
                                        name="name"
                                        defaultValue={editingList?.name || ''}
                                        placeholder="Ej. Lista del super, Regalos..."
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ícono</label>
                                    <EmojiPicker defaultValue={editingList?.icon || '📋'} />
                                </div>
                                <div className="pt-4 border-t border-border flex justify-end gap-3">
                                    <button type="button" onClick={() => { setIsListFormOpen(false); setEditingList(null) }} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
                                        Cancelar
                                    </button>
                                    <button disabled={loading === 'list-form'} type="submit" className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'list-form' ? <Loader2 className="w-4 h-4 animate-spin" /> : editingList ? 'Guardar' : 'Crear'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ============ CREATE WISH MODAL ============ */}
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

                                {/* List selector */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Lista</label>
                                    <select
                                        name="list_id"
                                        defaultValue={activeList && activeList !== 'general' ? activeList : ''}
                                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 appearance-none"
                                    >
                                        <option value="">General (sin lista)</option>
                                        {lists.map(l => (
                                            <option key={l.id} value={l.id}>{l.icon} {l.name}</option>
                                        ))}
                                    </select>
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
        </div>
    )
}

// ============================================================
// Emoji Picker sub-component
// ============================================================
function EmojiPicker({ defaultValue }: { defaultValue: string }) {
    const [selected, setSelected] = useState(defaultValue)

    return (
        <div>
            <input type="hidden" name="icon" value={selected} />
            <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(emoji => (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => setSelected(emoji)}
                        className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all border ${selected === emoji
                            ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30 scale-110'
                            : 'border-border bg-secondary hover:bg-secondary/80'
                            }`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    )
}
