'use client'

import { useEffect, useState } from 'react'
import { TaskReminderScheduler } from '@/components/shared/TaskReminderScheduler'
import { requestNotificationPermission, getNotificationStatus } from '@/lib/notifications'
import { Bell, BellOff, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Client-side wrapper that handles:
 * 1. Showing a non-intrusive notification permission prompt  
 * 2. Mounting the background TaskReminderScheduler
 */
export function NotificationProvider() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        // Only show prompt if not already granted/denied and not dismissed
        const status = getNotificationStatus()
        if (status === 'default') {
            // Show prompt after 5 seconds so it's not jarring
            const timer = setTimeout(() => {
                const wasDismissed = localStorage.getItem('notif-prompt-dismissed')
                if (!wasDismissed) {
                    setShowPrompt(true)
                }
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [])

    async function handleEnable() {
        const granted = await requestNotificationPermission()
        setShowPrompt(false)
        if (!granted) {
            console.log('Notification permission denied')
        }
    }

    function handleDismiss() {
        setShowPrompt(false)
        setDismissed(true)
        localStorage.setItem('notif-prompt-dismissed', 'true')
    }

    return (
        <>
            {/* Background scheduler — always mounted */}
            <TaskReminderScheduler />

            {/* Non-intrusive permission prompt */}
            <AnimatePresence>
                {showPrompt && !dismissed && (
                    <motion.div
                        initial={{ opacity: 0, y: 80, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 80, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[380px] z-[60]"
                    >
                        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/20 p-5">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <Bell className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        ¿Activar recordatorios?
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Recibí notificaciones cuando tus tareas tengan un horario de recordatorio. Funciona en PC y celular.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={handleEnable}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                                        >
                                            Activar
                                        </button>
                                        <button
                                            onClick={handleDismiss}
                                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                                        >
                                            Ahora no
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDismiss}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
