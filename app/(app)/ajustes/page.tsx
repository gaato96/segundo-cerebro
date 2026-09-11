import { getPushStatus } from '@/lib/actions/notifications'
import { NotificationSettings } from '@/components/notifications/NotificationSettings'
import { Bell } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AjustesPage() {
    const status = await getPushStatus().catch(() => ({
        prefs: null,
        devices: [] as any[],
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
        configured: false
    }))

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in pb-24">
            <div>
                <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">Ajustes</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Notificaciones y preferencias del Segundo Cerebro.
                </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                Notificaciones
            </div>

            <NotificationSettings
                prefs={status.prefs}
                devices={status.devices}
                vapidPublicKey={status.vapidPublicKey}
                configured={status.configured}
            />
        </div>
    )
}
