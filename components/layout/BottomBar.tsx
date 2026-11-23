'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, MOBILE_PRIMARY, ALL_HREFS, isNavActive } from '@/lib/navigation'
import { getInboxCount } from '@/lib/actions/capture'

/**
 * Barra del celular: Hoy · Plan · [Capturar] · Tareas · Copiloto.
 * El botón ámbar del centro es la captura (todo cae en el Inbox).
 * "Más" se abre desde el avatar de la cabecera: hoja con todas las secciones.
 */
export function BottomBar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const [inbox, setInbox] = useState(0)

    useEffect(() => { setOpen(false) }, [pathname])
    useEffect(() => {
        const onMore = () => setOpen(true)
        window.addEventListener('sc:more', onMore)
        return () => window.removeEventListener('sc:more', onMore)
    }, [])
    useEffect(() => {
        let alive = true
        const load = () => getInboxCount().then(n => alive && setInbox(n)).catch(() => { })
        load()
        window.addEventListener('sc:captured', load)
        return () => { alive = false; window.removeEventListener('sc:captured', load) }
    }, [pathname])

    const allItems = NAV_GROUPS.flatMap(g => g.items)
    const primary = MOBILE_PRIMARY.map(href => allItems.find(i => i.href === href)!).filter(Boolean)
    const left = primary.slice(0, 2)
    const right = primary.slice(2)

    const NavLink = ({ item }: { item: typeof primary[number] }) => {
        const active = isNavActive(pathname, item.href, ALL_HREFS)
        return (
            <Link href={item.href} className="flex flex-col items-center justify-center gap-1 h-14">
                <item.icon className={cn('w-5 h-5', active ? 'text-amber-400' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] font-medium', active ? 'text-amber-400' : 'text-muted-foreground')}>
                    {item.short || item.label}
                </span>
                <span className={cn('w-1 h-1 rounded-full', active ? 'bg-amber-400' : 'bg-transparent')} />
            </Link>
        )
    }

    return (
        <>
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="md:hidden fixed inset-0 z-50 bg-black/60"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                            className="md:hidden fixed inset-x-0 bottom-0 z-[60] max-h-[86dvh] overflow-y-auto rounded-t-3xl bg-card border-t border-hairline px-4 pt-3"
                            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
                        >
                            <div className="mx-auto h-1 w-10 rounded-full bg-raised" />
                            <div className="flex items-center justify-between pt-3 pb-1">
                                <p className="text-sm font-semibold">Todas las secciones</p>
                                <button onClick={() => setOpen(false)} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-muted-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {NAV_GROUPS.map(group => (
                                <div key={group.label} className="mt-4">
                                    <p className="label-caps pb-2 !text-[10px]">{group.label}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {group.items.map(item => {
                                            const active = isNavActive(pathname, item.href, ALL_HREFS)
                                            const badge = item.href === '/inbox' && inbox > 0 ? inbox : null
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl h-20 border transition-colors',
                                                        active ? 'lamp text-amber-300' : 'bg-raised/60 border-hairline text-foreground/85'
                                                    )}
                                                >
                                                    <item.icon className={cn('w-5 h-5', active ? 'text-amber-400' : 'text-muted-foreground')} />
                                                    <span className="text-[11px] font-medium text-center leading-tight px-1">{item.short || item.label}</span>
                                                    {badge && (
                                                        <span className="absolute top-2 right-2 font-mono text-[10px] px-1.5 rounded-md lamp text-amber-300">{badge}</span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-hairline" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="grid grid-cols-5 items-end px-2">
                    {left.map(item => <NavLink key={item.href} item={item} />)}
                    <div className="flex flex-col items-center justify-end h-14">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-capture'))}
                            aria-label="Capturar"
                            className="relative -mt-6 w-14 h-14 rounded-full bg-amber-400 text-background flex items-center justify-center active:translate-y-px shadow-[0_6px_20px_-6px_rgba(224,165,75,0.55)]"
                        >
                            <Plus className="w-6 h-6" strokeWidth={2.4} />
                            {inbox > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-card border border-hairline font-mono text-[10px] text-foreground flex items-center justify-center">
                                    {inbox}
                                </span>
                            )}
                        </button>
                        <span className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Capturar</span>
                    </div>
                    {right.map(item => <NavLink key={item.href} item={item} />)}
                </div>
            </nav>
        </>
    )
}
