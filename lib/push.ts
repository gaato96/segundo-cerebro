import webpush from 'web-push'

/**
 * Envío de Web Push. Se usa tanto desde server actions (notificación de prueba)
 * como desde el cron.
 */

let configured = false

export function isPushConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY
    )
}

function ensureConfigured() {
    if (configured) return
    if (!isPushConfigured()) {
        throw new Error(
            'Faltan las claves VAPID. Generalas con `npx web-push generate-vapid-keys` ' +
            'y ponelas en NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.'
        )
    }
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@segundocerebro.app',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
    )
    configured = true
}

export interface PushPayload {
    title: string
    body: string
    url?: string
    tag?: string
    requireInteraction?: boolean
    renotify?: boolean
    actions?: { action: string; title: string }[]
}

export interface SubscriptionRow {
    id: string
    endpoint: string
    p256dh: string
    auth: string
}

export interface SendResult {
    delivered: number
    /** Endpoints que el navegador dio de baja: hay que borrarlos de la tabla. */
    expired: string[]
    errors: string[]
}

/** Manda un payload a todos los dispositivos de una lista de suscripciones. */
export async function sendPushToSubscriptions(
    subscriptions: SubscriptionRow[],
    payload: PushPayload
): Promise<SendResult> {
    ensureConfigured()

    const result: SendResult = { delivered: 0, expired: [], errors: [] }
    const body = JSON.stringify(payload)

    await Promise.all(subscriptions.map(async sub => {
        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                },
                body,
                { TTL: 60 * 60 * 6 }
            )
            result.delivered++
        } catch (e: any) {
            const status = e?.statusCode
            // 404/410: el navegador revocó la suscripción, no vuelve a servir.
            if (status === 404 || status === 410) {
                result.expired.push(sub.endpoint)
            } else {
                result.errors.push(`${status || '?'}: ${e?.message || e}`)
            }
        }
    }))

    return result
}
