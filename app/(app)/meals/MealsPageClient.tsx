'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wand2, RefreshCw, ShoppingCart, Loader2, ListChecks, Bike, ExternalLink, Utensils } from 'lucide-react'
import { generateWeeklyMenu, saveMenuState, importFrequentRecipes, updateSingleMeal } from '@/lib/actions/meals'
import { RecipeForm } from './RecipeForm'
import { RecipeManager } from './RecipeManager'
import { ShoppingListModal } from './ShoppingListModal'
import { ManualMealSelectorModal } from '@/components/meals/ManualMealSelectorModal'
import { RecipeRecommenderWidget } from '@/components/meals/RecipeRecommenderWidget'
import { ModuleTabs } from '@/components/layout/ModuleTabs'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState, Check } from '@/components/ui/kit'
import { Modal } from '@/components/ui/controls'
import { addDaysToDateStr, getLocalDateStr, cn } from '@/lib/utils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DELIVERY = { recipe_id: 'delivery', name: 'Delivery' }
const label = (r: any) => r?.recipe_id === 'delivery' ? 'Delivery' : r?.name || 'Sin asignar'

export default function MealsPageClient({ initialRecipes: recipes, initialMenu, startDate }: any) {
    const router = useRouter()
    const [menu, setMenu] = useState<any>(initialMenu)
    const [busy, setBusy] = useState<string | null>(null)
    const [day, setDay] = useState<string | null>(null)
    const [modal, setModal] = useState<'add' | 'manage' | 'shopping' | null>(null)
    const [slot, setSlot] = useState<{ day: string; type: 'Almuerzo' | 'Cena' } | null>(null)
    const today = getLocalDateStr()
    const list: any[] = menu?.shopping_list || []
    const pending = list.filter(i => !i.checked).length

    async function generate(only?: string) {
        if (!only && menu && !confirm('Esto reemplaza todo el menú de la semana. ¿Seguimos?')) return
        setBusy(only || 'all')
        try {
            const res: any = only ? await generateWeeklyMenu(startDate, true, only) : await generateWeeklyMenu(startDate)
            if (res.error) return alert(res.error)
            if (!res.data) return
            if (only) {
                const data = { ...menu.menu_data, [only]: res.data.menu[only] }
                setMenu({ ...menu, menu_data: data })
                await saveMenuState(startDate, data, list)
            } else setMenu({ menu_data: res.data.menu, shopping_list: res.data.shopping_list })
        } catch (e: any) { alert(`No se pudo generar: ${e.message}`) } finally { setBusy(null) }
    }
    async function delivery(d: string) {
        const data = { ...menu?.menu_data, [d]: { lunch: DELIVERY, dinner: DELIVERY } }
        setMenu({ ...menu, menu_data: data })
        await saveMenuState(startDate, data, list)
    }
    async function choose(id: string, name: string) {
        if (!slot) return
        const type = slot.type === 'Almuerzo' ? 'lunch' : 'dinner'
        try {
            await updateSingleMeal(startDate, slot.day, type, id, name)
            const cur = menu?.menu_data?.[slot.day] || {}
            const next = id === 'delivery' ? { lunch: DELIVERY, dinner: DELIVERY } : { ...cur, [type]: { recipe_id: id, name: name || 'Sin asignar' } }
            setMenu({ ...menu, menu_data: { ...menu?.menu_data, [slot.day]: next } })
            setSlot(null)
        } catch (e: any) { alert(`No se pudo asignar: ${e.message}`) }
    }
    async function toggle(item: string, checked: boolean) {
        const next = list.map(i => i.item === item ? { ...i, checked } : i)
        setMenu({ ...menu, shopping_list: next })
        await saveMenuState(startDate, menu.menu_data, next)
    }
    const selected = day ? menu?.menu_data?.[day] : null

    return (
        <PageShell wide>
            <PageHeader label="Cuerpo · menú" title="Menú semanal" subtitle="Qué se come cada día y qué falta comprar."
                actions={<><ModuleTabs module="nutricion" /><button onClick={() => setModal('manage')} className="btn-secondary text-sm"><ListChecks className="w-4 h-4" /> Recetas <span className="font-mono text-xs text-muted-foreground">{recipes.length}</span></button><button onClick={() => setModal('add')} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Receta</button><button onClick={() => generate()} disabled={!!busy || !recipes.length} className="btn-primary text-sm">{busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {menu ? 'Rearmar semana' : 'Armar semana'}</button></>} />

            {recipes.length === 0 ? <EmptyState icon={Utensils} title="Cargá tus comidas" hint="Con tus recetas la IA arma el menú. Podés empezar con 24 comidas frecuentes." action={<button disabled={!!busy} onClick={async () => { setBusy('import'); try { await importFrequentRecipes(); router.refresh() } catch (e: any) { alert(e.message) } finally { setBusy(null) } }} className="btn-primary text-sm">Cargar 24 recetas</button>} /> : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 min-w-0">
                        <div className="rounded-2xl bg-card border border-hairline divide-y divide-hairline overflow-hidden">
                            {DAYS.map((d, i) => {
                                const date = addDaysToDateStr(startDate, i), isToday = date === today, data = menu?.menu_data?.[d]
                                const isDelivery = data?.lunch?.recipe_id === 'delivery' && data?.dinner?.recipe_id === 'delivery'
                                return (
                                    <div key={d} className={cn('relative grid sm:grid-cols-[110px_1fr_1fr] gap-x-5 gap-y-2 px-5 py-4', isToday && 'bg-amber-400/10', busy === d && 'animate-pulse')}>
                                        {isToday && <span className="absolute left-0 inset-y-3 w-[2px] rounded-full bg-amber-400" />}
                                        <button onClick={() => setDay(d)} className="text-left"><span className={cn('text-sm font-medium', isToday && 'text-amber-300')}>{NAMES[i]}</span><span className="block font-mono text-[11px] text-muted-foreground">{date.slice(8)}/{date.slice(5, 7)}{isToday ? ' · hoy' : ''}</span></button>
                                        {isDelivery ? <button onClick={() => setDay(d)} className="sm:col-span-2 text-left text-sm text-muted-foreground inline-flex items-center gap-2"><Bike className="w-4 h-4" /> Día de delivery</button> : (['lunch', 'dinner'] as const).map(k => <button key={k} onClick={() => data ? setDay(d) : setSlot({ day: d, type: k === 'lunch' ? 'Almuerzo' : 'Cena' })} className="text-left min-w-0"><span className="label-caps !text-[10px] block">{k === 'lunch' ? 'Almuerzo' : 'Cena'}</span><span className={cn('text-sm leading-snug', !data?.[k]?.name && 'text-ink-faint')}>{label(data?.[k])}</span></button>)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <aside className="lg:col-span-4 min-w-0 space-y-4">
                        <Panel>
                            <SectionLabel right={list.length ? `${pending} de ${list.length} pendientes` : undefined}>Compras</SectionLabel>
                            {list.length === 0 ? <p className="text-sm text-muted-foreground">Aparece sola al armar la semana.</p> : <><div className="divide-y divide-hairline">{[...list].sort((a, b) => Number(!!a.checked) - Number(!!b.checked)).slice(0, 8).map((i, n) => <button key={n} onClick={() => toggle(i.item, !i.checked)} className="w-full flex items-center gap-3 min-h-[44px] text-left text-sm"><Check done={!!i.checked} /><span className={cn('flex-1 truncate', i.checked && 'line-through text-muted-foreground')}>{i.item}</span><span className="font-mono text-xs text-muted-foreground">{[i.amount, i.unit].filter(Boolean).join(' ')}</span></button>)}</div><button onClick={() => setModal('shopping')} className="btn-secondary w-full text-sm mt-3"><ShoppingCart className="w-4 h-4" /> Lista completa</button></>}
                        </Panel>
                        <RecipeRecommenderWidget />
                    </aside>
                </div>
            )}

            <Modal open={!!day} wide title={day ? NAMES[DAYS.indexOf(day)] : ''} onClose={() => setDay(null)}>
                {day && <div className="space-y-5">
                    <div className="flex flex-wrap gap-2"><button onClick={() => delivery(day)} className="btn-secondary text-sm"><Bike className="w-4 h-4" /> Delivery</button><button disabled={!!busy || !menu} onClick={() => generate(day)} className="btn-secondary text-sm"><RefreshCw className={cn('w-4 h-4', busy === day && 'animate-spin')} /> Rearmar día</button></div>
                    <div className="grid sm:grid-cols-2 gap-6">{(['lunch', 'dinner'] as const).map(k => {
                        const r = recipes.find((x: any) => x.id === selected?.[k]?.recipe_id)
                        return <section key={k}><SectionLabel right={<button onClick={() => { setSlot({ day, type: k === 'lunch' ? 'Almuerzo' : 'Cena' }); setDay(null) }} className="hover:text-foreground min-h-[32px]">cambiar</button>}>{k === 'lunch' ? 'Almuerzo' : 'Cena'}</SectionLabel><p className="font-medium">{r?.name || label(selected?.[k])}{r?.link && <a href={r.link} target="_blank" rel="noreferrer" aria-label="Ver receta" className="inline-flex ml-2 align-middle text-muted-foreground"><ExternalLink className="w-4 h-4" /></a>}</p>{r && <><p className="text-xs text-muted-foreground mt-1">{[r.complexity, r.protein_type].filter(Boolean).join(' · ')}</p><ul className="mt-3 divide-y divide-hairline text-sm">{(r.ingredients || []).map((g: any, i: number) => <li key={i} className="flex justify-between gap-3 py-1.5"><span>{g.item}</span><span className="font-mono text-xs text-muted-foreground">{g.amount} {g.unit}</span></li>)}</ul>{r.steps && <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{r.steps}</p>}</>}</section>
                    })}</div>
                </div>}
            </Modal>
            {modal === 'add' && <RecipeForm onClose={() => { setModal(null); router.refresh() }} />}
            {modal === 'manage' && <RecipeManager recipes={recipes} onClose={() => setModal(null)} />}
            {modal === 'shopping' && <ShoppingListModal shoppingList={list} onClose={() => setModal(null)} onToggleItem={toggle} />}
            {slot && <ManualMealSelectorModal dayName={NAMES[DAYS.indexOf(slot.day)]} mealType={slot.type as any} recipes={recipes} onClose={() => setSlot(null)} onSelect={choose} />}
        </PageShell>
    )
}
