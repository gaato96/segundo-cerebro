'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getTodayReminders } from '@/lib/actions/notifications'
import type { DueReminder } from '@/lib/reminders'

/**
 * Vigilante de recordatorios para la PC.
 *
 * Mientras tengas la app abierta en alguna pestaña (aunque esté de fondo o
 * minimizada), mira cada 20 segundos si llegó la hora de una tarea o hábito y
 * muestra una notificación del sistema. No depende del cron del servidor.
 *
 * - Los avisos ya mostrados se guardan por día en localStorage para no repetir.
 * - El tag es el mismo que usa el push del servidor: si llegan los dos, Windows
 *   muestra uno solo.
 * - Avisos atrasados (abriste la compu tarde) salen igual, hasta 3 horas después.
 */

const REFRESH_MS = 2 * 60 * 1000
const TICK_MS = 20 * 1000
const LATE_LIMIT_MIN = 180

function nowMinutesAR(): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date())
    const h = Number(parts.find(p => p.type === 'hour')?.value || 0)
    const m = Number(parts.find(p => p.type === 'minute')?.value || 0)
    return (h % 24) * 60 + m
}

function toMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

function firedKey(today: string) {
    return `sc-reminders-fired-${today}`
}

function loadFired(today: string): Set<string> {
    try {
        return new Set(JSON.parse(localStorage.getItem(firedKey(today)) || '[]'))
    } catch {
        return new Set()
    }
}

function saveFired(today: string, fired: Set<string>) {
    try {
        localStorage.setItem(firedKey(today), JSON.stringify(Array.from(fired)))
        // Limpia días viejos
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i)
            if (k && k.startsWith('sc-reminders-fired-') && k !== firedKey(today)) localStorage.removeItem(k)
        }
    } catch { /* sin storage */ }
}

async function show(r: DueReminder) {
    const title = r.kind === 'habit' ? `Hábito: ${r.title}` : `Tarea: ${r.title}`
    const body = r.kind === 'habit'
        ? `Son las ${r.time}. Tocá para abrir y tildarlo.`
        : `Son las ${r.time}. Tocá para abrir tus tareas.`
    const options: NotificationOptions & { renotify?: boolean } = {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `rem-${r.id}`,
        requireInteraction: true,
        data: { url: r.url }
    }

    try {
        const reg = 'serviceWorker' in navigator
            ? await Promise.race([
                navigator.serviceWorker.getRegistration(),
                new Promise<undefined>(res => setTimeout(() => res(undefined), 1500))
            ])
            : undefined
        if (reg) {
            await reg.showNotification(title, options)
            return
        }
    } catch { /* cae a Notification directa */ }

    const n = new Notification(title, options)
    n.onclick = () => {
        window.focus()
        window.location.href = r.url
        n.close()
    }
}

export function PcReminders() {
    const pathname = usePathname()
    const state = useRef<{ today: string; reminders: DueReminder[]; loadedAt: number }>({
        today: '', reminders: [], loadedAt: 0
    })

    // Al cambiar de página se refresca la lista (por si creaste o tildaste algo).
    useEffect(() => {
        state.current.loadedAt = 0
    }, [pathname])

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return
        let stopped = false
        let loading = false

        async function refresh() {
            if (loading) return
            loading = true
            try {
                const res = await getTodayReminders()
                state.current = { ...res, loadedAt: Date.now() }
            } catch { /* sin red: se reintenta en el próximo tick */ }
            finally { loading = false }
        }

        async function tick() {
            if (stopped || Notification.permission !== 'granted') return
            if (Date.now() - state.current.loadedAt > REFRESH_MS) await refresh()
            const { today, reminders } = state.current
            if (!today || !reminders.length) return

            const now = nowMinutesAR()
            const fired = loadFired(today)
            let changed = false
            for (const r of reminders) {
                if (fired.has(r.key)) continue
                const diff = now - toMinutes(r.time)
                if (diff < 0) continue
                fired.add(r.key)
                changed = true
                if (diff <= LATE_LIMIT_MIN) await show(r).catch(() => {})
            }
            if (changed) saveFired(today, fired)
        }

        tick()
        const id = window.setInterval(tick, TICK_MS)
        const onFocus = () => { state.current.loadedAt = 0; tick() }
        window.addEventListener('focus', onFocus)
        window.addEventListener('sc:reminders-changed', onFocus)
        return () => {
            stopped = true
            window.clearInterval(id)
            window.removeEventListener('focus', onFocus)
            window.removeEventListener('sc:reminders-changed', onFocus)
        }
    }, [])

    return null
}
