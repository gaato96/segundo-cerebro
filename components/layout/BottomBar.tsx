'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, MOBILE_PRIMARY, ALL_HREFS, isNavActive } from '@/lib/navigation'

/**
 * Barra del celular: 4 accesos fijos + "Más".
 * Antes eran 22 íconos en un carrusel horizontal, y lo que no entraba en
 * pantalla prácticamente no existía.
 */
export function BottomBar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    // Cerrar el panel al navegar
    useEffect(() => { setOpen(false) }, [pathname])

    const allItems = NAV_GROUPS.flatMap(g => g.items)
    const primary = MOBILE_PRIMARY.map(href => allItems.find(i => i.href === href)!).filter(Boolean)
    const moreActive = !primary.some(i => isNavActive(pathname, i.href, ALL_HREFS))

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
                            className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                            className="md:hidden fixed inset-x-0 bottom-0 z-[60] max-h-[82vh] overflow-y-auto rounded-t-3xl bg-background border-t border-border/60 px-4 pt-3"
                            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
                        >
                            <div className="flex items-center justify-between pb-2">
                                <div className="mx-auto h-1 w-10 rounded-full bg-border" />
                                <button onClick={() => setOpen(false)} aria-label="Cerrar" className="absolute right-4 top-3 p-1.5 rounded-lg text-muted-foreground hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {NAV_GROUPS.map(group => (
                                <div key={group.label} className="mt-3">
                                    <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {group.items.map(item => {
                                            const active = isNavActive(pathname, item.href, ALL_HREFS)
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 border transition',
                                                        active ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'border-transparent bg-secondary/30 text-muted-foreground'
                                                    )}
                                                >
                                                    <item.icon className="w-5 h-5" />
                                                    <span className="text-[10px] font-medium text-center leading-tight">{item.short || item.label}</span>
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

            <nav className="md:hidden fixed bottom-0 inset-x-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="glass border-t border-border/50 backdrop-blur-xl">
                    <div className="grid grid-cols-5 px-2 py-2 gap-1">
                        {primary.map(item => {
                            const isActive = isNavActive(pathname, item.href, ALL_HREFS)
                            return (
                                <Link key={item.href} href={item.href} className="relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl">
                                    {isActive && (
                                        <motion.div
                                            layoutId="bottom-active"
                                            className="absolute inset-0 bg-indigo-600/20 rounded-xl border border-indigo-500/20"
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                    <item.icon className={cn('w-5 h-5 relative z-10', isActive ? 'text-indigo-400' : 'text-muted-foreground')} />
                                    <span className={cn('text-[10px] font-medium relative z-10', isActive ? 'text-indigo-400' : 'text-muted-foreground')}>
                                        {item.short || item.label}
                                    </span>
                                </Link>
                            )
                        })}
                        <button onClick={() => setOpen(true)} className="relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl">
                            {moreActive && !open && <div className="absolute inset-0 bg-indigo-600/20 rounded-xl border border-indigo-500/20" />}
                            <LayoutGrid className={cn('w-5 h-5 relative z-10', moreActive ? 'text-indigo-400' : 'text-muted-foreground')} />
                            <span className={cn('text-[10px] font-medium relative z-10', moreActive ? 'text-indigo-400' : 'text-muted-foreground')}>Más</span>
                        </button>
                    </div>
                </div>
            </nav>
        </>
    )
}
