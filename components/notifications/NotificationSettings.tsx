'use client'

import { useState, useEffect } from 'react'
import {
    Bell, BellOff, Loader2, Check, Smartphone, Trash2,
    AlertTriangle, Send, Info
} from 'lucide-react'
import {
    savePushSubscription, removePushSubscription,
    saveNotificationPrefs, sendTestNotification
} from '@/lib/actions/notifications'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props {
    prefs: any
    devices: any[]
    vapidPublicKey: string | null
    configured: boolean
}

/** La clave VAPID viaja en base64url; el navegador la quiere como bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(base64)
    const output = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
    return output
}

const TOGGLES: { key: string; label: string; desc: string; timeKey?: string }[] = [
    {
        key: 'commitment_reminder',
        label: 'Recordatorio del compromiso',
        desc: 'Justo a la hora que firmaste, con la versión de 2 minutos adentro. Es el que más importa.'
    },
    {
        key: 'morning_briefing',
        label: 'Briefing de la mañana',
        desc: 'Compromiso del día, tareas, hábitos pendientes y si te toca entrenar.',
        timeKey: 'morning_time'
    },
    {
        key: 'training_reminder',
        label: 'Entrenamiento sin hacer',
        desc: 'A las 18:00, solo los días que te toca y todavía no registraste la sesión.'
    },
    {
        key: 'evening_ritual',
        label: 'Cierre del día',
        desc: 'Para resolver el compromiso de hoy y firmar el de mañana.',
        timeKey: 'evening_time'
    },
    {
        key: 'weekly_review',
        label: 'Revisión semanal',
        desc: 'Solo los domingos.',
        timeKey: 'weekly_review_time'
    },
    {
        key: 'overdue_tasks',
        label: 'Avisar tareas vencidas',
        desc: 'Se suma al briefing de la mañana cuando hay vencidas.'
    }
]

export function NotificationSettings({ prefs, devices, vapidPublicKey, configured }: Props) {
    const router = useRouter()
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
    const [busy, setBusy] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
    const [localPrefs, setLocalPrefs] = useState<any>(prefs || {
        enabled: true,
        commitment_reminder: true,
        morning_briefing: true,
        morning_time: '07:00',
        evening_ritual: true,
        evening_time: '21:30',
        training_reminder: true,
        overdue_tasks: true,
        weekly_review: true,
        weekly_review_time: '19:00'
    })

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPermission('unsupported')
            return
        }
        setPermission(Notification.permission)
    }, [])

    async function handleEnable() {
        setBusy(true)
        setMessage(null)
        try {
            if (!vapidPublicKey) {
                throw new Error('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el entorno.')
            }

            const perm = await Notification.requestPermission()
            setPermission(perm)
            if (perm !== 'granted') {
                throw new Error('No diste permiso. Si lo bloqueaste, hay que habilitarlo desde la configuración del navegador.')
            }

            // Registramos nuestro propio SW: no dependemos de next-pwa, que no
            // corre bajo Turbopack y dejaría la app sin handler de push.
            const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
            await navigator.serviceWorker.ready

            let sub = await registration.pushManager.getSubscription()
            if (!sub) {
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
                })
            }

            const json = sub.toJSON() as any
            await savePushSubscription({
                endpoint: sub.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                userAgent: navigator.userAgent
            })

            setMessage({ type: 'ok', text: 'Dispositivo registrado. Probá con el botón de abajo.' })
            router.refresh()
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message || 'No se pudo activar.' })
        } finally {
            setBusy(false)
        }
    }

    async function handleRemove(endpoint: string) {
        setBusy(true)
        try {
            await removePushSubscription(endpoint)
            const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
            const sub = await registration?.pushManager.getSubscription()
            if (sub && sub.endpoint === endpoint) await sub.unsubscribe()
            router.refresh()
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message })
        } finally {
            setBusy(false)
        }
    }

    async function handleTest() {
        setTesting(true)
        setMessage(null)
        try {
            const res = await sendTestNotification()
            setMessage({ type: 'ok', text: `Enviada a ${res.delivered} dispositivo${res.delivered > 1 ? 's' : ''}.` })
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message })
        } finally {
            setTesting(false)
        }
    }

    async function updatePref(patch: Record<string, any>) {
        const next = { ...localPrefs, ...patch }
        setLocalPrefs(next)
        try {
            await saveNotificationPrefs(patch)
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message })
        }
    }

    const hasDevices = devices.length > 0

    return (
        <div className="space-y-5">
            {!configured && (
                <div className="glass p-4 rounded-2xl border border-amber-500/30 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Faltan las claves VAPID en el servidor. Generalas con{' '}
                        <code className="text-amber-300">npx web-push generate-vapid-keys</code> y cargá
                        <code className="text-amber-300"> NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> y
                        <code className="text-amber-300"> VAPID_PRIVATE_KEY</code> en el entorno.
                    </p>
                </div>
            )}

            {permission === 'unsupported' && (
                <div className="glass p-4 rounded-2xl border border-border/50 flex gap-3">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Este navegador no soporta notificaciones push. En iPhone tenés que instalar la app
                        desde Safari con <strong className="text-foreground">Compartir → Agregar a inicio</strong> y
                        abrirla desde ahí.
                    </p>
                </div>
            )}

            {/* Activación */}
            <div className="glass p-5 rounded-2xl border border-indigo-500/20 space-y-4">
                <div className="flex items-start gap-3">
                    <div className={cn(
                        'p-2.5 rounded-xl border shrink-0',
                        hasDevices
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
                            : 'bg-secondary text-muted-foreground border-border'
                    )}>
                        {hasDevices ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-heading font-bold text-foreground">
                            {hasDevices ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            Sin esto, el compromiso vive en una pantalla que tenés que acordarte de abrir.
                            Con esto, te busca él a vos a la hora que firmaste.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleEnable}
                        disabled={busy || permission === 'unsupported' || !configured}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        {hasDevices ? 'Registrar este dispositivo' : 'Activar notificaciones'}
                    </button>

                    {hasDevices && (
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="px-4 py-2.5 glass border border-border/50 hover:bg-secondary/60 text-foreground rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-indigo-400" />}
                            Probar
                        </button>
                    )}
                </div>

                {message && (
                    <p className={cn(
                        'text-[11px] leading-relaxed',
                        message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                        {message.text}
                    </p>
                )}

                {hasDevices && (
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block pt-2">
                            Dispositivos ({devices.length})
                        </span>
                        {devices.map((d: any) => (
                            <div key={d.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate flex-1">
                                    {(d.user_agent || 'Dispositivo desconocido').slice(0, 60)}
                                </span>
                                <button
                                    onClick={() => handleRemove(d.endpoint)}
                                    disabled={busy}
                                    className="text-muted-foreground hover:text-red-400 transition-colors p-1 shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preferencias */}
            <div className="glass p-5 rounded-2xl border border-border/50 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-heading font-bold text-foreground">Qué quiero que me avise</h3>
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={localPrefs.enabled}
                            onChange={e => updatePref({ enabled: e.target.checked })}
                            className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-[11px] font-semibold text-foreground">Todo</span>
                    </label>
                </div>

                <div className={cn('space-y-2.5', !localPrefs.enabled && 'opacity-40 pointer-events-none')}>
                    {TOGGLES.map(t => (
                        <div key={t.key} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/40">
                            <input
                                type="checkbox"
                                checked={Boolean(localPrefs[t.key])}
                                onChange={e => updatePref({ [t.key]: e.target.checked })}
                                className="w-4 h-4 accent-indigo-500 mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-foreground">{t.label}</span>
                                <span className="block text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</span>
                            </div>
                            {t.timeKey && (
                                <input
                                    type="time"
                                    value={String(localPrefs[t.timeKey] || '').slice(0, 5)}
                                    onChange={e => updatePref({ [t.timeKey!]: e.target.value })}
                                    className="bg-background/60 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                            )}
                        </div>
                    ))}
                </div>

                <p className="text-[10px] text-muted-foreground flex items-start gap-1.5 pt-1">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    Máximo 4 avisos por día. El objetivo es que cada uno importe, no que te acostumbres a ignorarlos.
                </p>
            </div>
        </div>
    )
}
