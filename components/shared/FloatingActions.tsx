'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Brain, MessageCircleHeart, Receipt, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Único botón flotante de la app: al tocarlo despliega los accesos rápidos.
 *
 * Cada acceso solo dispara un evento de window; el modal que corresponde lo
 * escucha y se abre (también los abren sus atajos de teclado y otras pantallas).
 * Para sumar un acceso nuevo: agregarlo a ACTIONS y escuchar su evento en el modal.
 */

interface FloatingAction {
    id: string
    label: string
    shortcut?: string
    icon: LucideIcon
    /** Clases del círculo del ícono */
    color: string
    event: string
    detail?: unknown
}

// El primero queda más cerca del botón.
const ACTIONS: FloatingAction[] = [
    {
        id: 'capture',
        label: 'Capturar en Inbox',
        shortcut: 'Ctrl+Shift+K',
        icon: Brain,
        color: 'bg-indigo-600 shadow-indigo-600/40',
        event: 'sc:quick-capture'
    },
    {
        id: 'expense',
        label: 'Registrar gasto',
        shortcut: 'Ctrl+Shift+L',
        icon: Receipt,
        color: 'bg-emerald-600 shadow-emerald-600/40',
        event: 'sc:quick-expense',
        detail: { kind: 'expense' }
    },
    {
        id: 'assistant',
        label: 'Copiloto',
        shortcut: 'Ctrl+J',
        icon: MessageCircleHeart,
        color: 'bg-violet-600 shadow-violet-600/40',
        event: 'sc:assistant'
    }
]

export function FloatingActions() {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    // Se cierra al cambiar de pantalla y con Escape.
    useEffect(() => { setOpen(false) }, [pathname])
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    function run(action: FloatingAction) {
        setOpen(false)
        window.dispatchEvent(new CustomEvent(action.event, { detail: action.detail }))
    }

    return (
        <>
            {/* Fondo: un toque afuera cierra el menú */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
                    />
                )}
            </AnimatePresence>

            <div className="fixed bottom-[88px] md:bottom-8 right-5 z-40 flex flex-col items-end gap-3">
                <AnimatePresence>
                    {open && (
                        <motion.ul
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={{
                                open: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
                                closed: { transition: { staggerChildren: 0.03 } }
                            }}
                            className="flex flex-col-reverse items-end gap-3"
                        >
                            {ACTIONS.map(action => (
                                <motion.li
                                    key={action.id}
                                    variants={{
                                        open: { opacity: 1, y: 0, scale: 1 },
                                        closed: { opacity: 0, y: 12, scale: 0.9 }
                                    }}
                                    transition={{ duration: 0.16 }}
                                >
                                    <button
                                        onClick={() => run(action)}
                                        title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                                        className="group flex items-center gap-3"
                                    >
                                        <span className="px-3 py-1.5 rounded-xl bg-[#141625]/95 border border-white/10 text-sm font-medium text-white shadow-lg whitespace-nowrap">
                                            {action.label}
                                        </span>
                                        <span className={cn(
                                            'w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 group-active:scale-95',
                                            action.color
                                        )}>
                                            <action.icon className="w-5 h-5" />
                                        </span>
                                    </button>
                                </motion.li>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setOpen(v => !v)}
                    aria-label={open ? 'Cerrar accesos rápidos' : 'Accesos rápidos'}
                    aria-expanded={open}
                    className={cn(
                        'w-[52px] h-[52px] rounded-full text-white flex items-center justify-center transition-colors',
                        open
                            ? 'bg-[#232538] border border-white/15 shadow-lg'
                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                    )}
                >
                    <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }} className="flex">
                        <Plus className="w-6 h-6" />
                    </motion.span>
                </motion.button>
            </div>
        </>
    )
}
