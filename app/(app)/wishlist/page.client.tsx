'use client'

import { useState } from 'react'
import { Heart, Plus, Trash2, ExternalLink, FolderPlus, Pencil } from 'lucide-react'
import { createWish, deleteWish, toggleWishPurchased, createWishlistList, updateWishlistList, deleteWishlistList, deletePurchasedWishes } from '@/lib/actions/wishlist'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState, Check } from '@/components/ui/kit'
import { Modal, Field, Segmented, StatStrip, Bar } from '@/components/ui/controls'
import { formatCurrency, cn } from '@/lib/utils'

type WishItem = { id: string; name: string; price: number; url?: string; category: string; desire_level: number; purchased: boolean; list_id: string | null; created_at?: string;[key: string]: unknown }
type WishList = { id: string; name: string; icon: string; position: number;[key: string]: unknown }

const CATEGORY: Record<string, string> = { Tech: 'Tecnología', Travel: 'Viajes', Home: 'Hogar', Fashion: 'Ropa', Experience: 'Experiencias', General: 'General' }
const COOL_DAYS = 21
const COOL_PRICE = 50000
const age = (i: WishItem) => i.created_at ? Math.floor((Date.now() - new Date(String(i.created_at)).getTime()) / 86400000) : 0
const cooling = (i: WishItem) => (i.price || 0) >= COOL_PRICE && age(i) < COOL_DAYS

export function WishlistClient({ items, lists }: { items: WishItem[]; lists: WishList[] }) {
    const [list, setList] = useState('all')
    const [view, setView] = useState<'pending' | 'bought'>('pending')
    const [form, setForm] = useState(false)
    const [listForm, setListForm] = useState<WishList | 'new' | null>(null)
    const [busy, setBusy] = useState<string | null>(null)

    const inList = items.filter(i => list === 'all' ? true : list === 'general' ? !i.list_id : i.list_id === list)
    const pending = inList.filter(i => !i.purchased).sort((a, b) => Number(cooling(a)) - Number(cooling(b)) || (b.desire_level || 0) - (a.desire_level || 0))
    const bought = inList.filter(i => i.purchased)
    const total = (xs: WishItem[]) => xs.reduce((n, i) => n + Number(i.price || 0), 0)
    const expensive = pending.filter(i => (i.price || 0) >= COOL_PRICE)
    const ready = expensive.filter(i => !cooling(i))
    const rows = view === 'pending' ? pending : bought
    const top = pending.find(i => !cooling(i))
    const current = lists.find(l => l.id === list)

    async function run(id: string, fn: () => Promise<unknown>) {
        setBusy(id)
        try { const r: any = await fn(); if (r?.error) alert(r.error); return !r?.error } catch { alert('No se pudo guardar.'); return false } finally { setBusy(null) }
    }

    return (
        <PageShell wide>
            <PageHeader label="Vida · compras meditadas" title="Deseos" subtitle="Anotá antes de comprar. El tiempo separa lo que querés de lo que se te antojó."
                actions={<><button onClick={() => setListForm('new')} className="btn-secondary text-sm"><FolderPlus className="w-4 h-4" /> Lista</button><button onClick={() => setForm(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Deseo</button></>} />
            <div className="mb-8"><StatStrip items={[
                { label: 'Pendientes', value: pending.length }, { label: 'Si comprás todo', value: formatCurrency(total(pending)) },
                { label: 'Prioridad sugerida', value: top ? (top.price ? formatCurrency(top.price) : 'sin precio') : '—', hint: top?.name }, { label: 'Ya comprado', value: formatCurrency(total(bought)), hint: `${bought.length} cumplidos` }
            ]} /></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented value={view} onChange={setView} options={[{ id: 'pending', label: 'Pendientes', count: pending.length }, { id: 'bought', label: 'Comprados', count: bought.length }]} />
                        <select value={list} onChange={e => setList(e.target.value)} aria-label="Lista" className="h-11 bg-card border border-hairline rounded-xl px-3 text-xs text-muted-foreground max-w-[200px]"><option value="all">Todas las listas</option><option value="general">General</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                        {current && <><button onClick={() => setListForm(current)} aria-label="Editar lista" className="w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                            <button onClick={async () => { if (confirm(`¿Eliminar la lista "${current.name}"? Se borran todos sus ítems.`) && await run('list', () => deleteWishlistList(current.id))) setList('all') }} aria-label="Eliminar lista" className="w-11 h-11 rounded-xl text-muted-foreground hover:text-red-300 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></>}
                    </div>
                    {rows.length === 0 ? <EmptyState icon={Heart} title={view === 'pending' ? 'Sin deseos en esta lista' : 'Todavía no compraste nada de acá'} /> : (
                        <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline overflow-hidden">
                            {rows.map((i, n) => {
                                const c = cooling(i), first = view === 'pending' && i.id === top?.id
                                return (
                                    <div key={i.id} className={cn('relative grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_120px_70px_110px_auto] items-center gap-x-4 gap-y-1 px-4 py-3', first && 'bg-amber-400/10', busy === i.id && 'opacity-50')}>
                                        {first && <span className="absolute left-0 inset-y-2 w-[2px] rounded-full bg-amber-400" />}
                                        <button onClick={() => run(i.id, () => toggleWishPurchased(i.id, !i.purchased))} aria-label={i.purchased ? 'Volver a pendientes' : 'Marcar comprado'} className="p-2 -m-2"><Check done={i.purchased} accent={first} /></button>
                                        <div className="min-w-0"><p className={cn('text-sm truncate', i.purchased && 'line-through text-muted-foreground')}>{i.name}</p><p className="text-xs text-muted-foreground truncate">{CATEGORY[i.category] || i.category}{list === 'all' && i.list_id ? ` · ${lists.find(l => l.id === i.list_id)?.name || ''}` : ''}{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ml-2 hover:text-foreground"><ExternalLink className="w-3 h-3" /> ver</a>}</p></div>
                                        <div className="hidden sm:block text-xs">{!i.purchased && <><p className="text-muted-foreground">hace {age(i)} días</p><p className={c ? 'text-ink-faint' : 'text-emerald-300'}>{c ? `faltan ${COOL_DAYS - age(i)}` : 'listo para decidir'}</p></>}</div>
                                        <div className="hidden sm:flex gap-0.5" aria-label={`Ganas ${i.desire_level} de 5`}>{[1, 2, 3, 4, 5].map(v => <span key={v} className={cn('w-2.5 h-1 rounded-full', v <= i.desire_level ? first ? 'bg-amber-400' : 'bg-graphite-300' : 'bg-raised')} />)}</div>
                                        <p className="font-mono text-sm text-right">{i.price > 0 ? formatCurrency(i.price) : '—'}</p>
                                        <button onClick={() => { if (confirm('¿Eliminar este deseo?')) run(i.id, () => deleteWish(i.id)) }} aria-label="Eliminar" className="hidden sm:flex w-9 h-9 items-center justify-center text-ink-faint hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {view === 'bought' && bought.length > 0 && <button onClick={() => { if (confirm('¿Eliminar para siempre TODOS los deseos comprados, de todas las listas?')) run('clear', deletePurchasedWishes) }} className="text-xs text-muted-foreground hover:text-red-300 min-h-[36px]">Vaciar comprados</button>}
                </div>

                <aside className="lg:col-span-4 space-y-4">
                    <Panel>
                        <SectionLabel>Regla de los 21 días</SectionLabel>
                        <p className="text-sm text-muted-foreground">Todo lo que cueste {formatCurrency(COOL_PRICE)} o más descansa 21 días en la lista. Si después lo seguís queriendo, se compra sin culpa.</p>
                        {expensive.length > 0 && <><div className="flex justify-between text-xs mt-4 mb-1.5"><span className="text-muted-foreground">Superaron la espera</span><span className="font-mono">{ready.length} de {expensive.length}</span></div><Bar pct={(ready.length / expensive.length) * 100} tone="good" /></>}
                    </Panel>
                    <Panel>
                        <SectionLabel>Por lista</SectionLabel>
                        <dl className="divide-y divide-hairline text-sm">{[{ id: 'general', name: 'General' }, ...lists].map(l => { const xs = items.filter(i => !i.purchased && (l.id === 'general' ? !i.list_id : i.list_id === l.id)); return <div key={l.id} className="flex justify-between gap-3 py-2"><dt className="truncate">{l.name} <span className="font-mono text-xs text-muted-foreground">{xs.length}</span></dt><dd className="font-mono text-muted-foreground">{formatCurrency(total(xs))}</dd></div> })}</dl>
                    </Panel>
                </aside>
            </div>

            <Modal open={form} title="Nuevo deseo" onClose={() => setForm(false)}>
                <form action={async fd => { if (await run('create', () => createWish(fd))) setForm(false) }} className="space-y-4">
                    <Field label="¿Qué querés?"><input required autoFocus name="name" className="field" /></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="Precio"><input type="number" step="0.01" name="price" className="field font-mono" /></Field><Field label="Ganas"><select name="desire_level" defaultValue="3" className="field"><option value="1">1 · Da igual</option><option value="2">2 · Estaría bien</option><option value="3">3 · Lo quiero</option><option value="4">4 · Lo necesito</option><option value="5">5 · Ya</option></select></Field></div>
                    <div className="grid grid-cols-2 gap-3"><Field label="Lista"><select name="list_id" defaultValue={current?.id || ''} className="field"><option value="">General</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Field label="Categoría"><select name="category" defaultValue="General" className="field">{Object.entries(CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field></div>
                    <Field label="Link (opcional)"><input name="url" type="url" className="field" /></Field>
                    <button disabled={busy === 'create'} className="btn-primary w-full text-sm">Guardar deseo</button>
                </form>
            </Modal>
            <Modal open={!!listForm} title={listForm === 'new' ? 'Nueva lista' : 'Editar lista'} onClose={() => setListForm(null)}>
                <form action={async fd => { if (await run('list', () => listForm && listForm !== 'new' ? updateWishlistList(listForm.id, fd) : createWishlistList(fd))) setListForm(null) }} className="space-y-4">
                    <input type="hidden" name="icon" value={listForm && listForm !== 'new' ? listForm.icon : '📋'} />
                    <Field label="Nombre"><input required autoFocus name="name" defaultValue={listForm && listForm !== 'new' ? listForm.name : ''} className="field" /></Field>
                    <button className="btn-primary w-full text-sm">Guardar lista</button>
                </form>
            </Modal>
        </PageShell>
    )
}
