'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPushToSubscriptions, isPushConfigured } from '@/lib/push'

/**
 * Suscripciones y preferencias de notificaciones push.
 *
 * El envío programado lo hace /api/notifications/cron; acá está todo lo que
 * necesita una sesión con usuario adelante.
 */

export interface NotificationPrefs {
    enabled: boolean
    commitment_reminder: boolean
    morning_briefing: boolean
    morning_time: string
    evening_ritual: boolean
    evening_time: string
    training_reminder: boolean
    overdue_tasks: boolean
    weekly_review: boolean
    weekly_review_time: string
}

export async function getPushStatus() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const [prefsRes, subsRes] = await Promise.all([
        supabase.from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('push_subscriptions').select('id, endpoint, user_agent, created_at').eq('user_id', user.id)
    ])

    return {
        prefs: prefsRes.data,
        devices: subsRes.data || [],
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
        configured: isPushConfigured()
    }
}

export async function savePushSubscription(sub: {
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            user_agent: sub.userAgent?.slice(0, 300) || null,
            failure_count: 0,
            last_used_at: new Date().toISOString()
        }, { onConflict: 'endpoint' })

    if (error) throw error

    // Al registrar el primer dispositivo se crean las preferencias por defecto.
    await supabase
        .from('notification_prefs')
        .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

    revalidatePath('/ajustes')
    return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)

    if (error) throw error
    revalidatePath('/ajustes')
    return { ok: true }
}

export async function saveNotificationPrefs(prefs: Partial<NotificationPrefs>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('notification_prefs')
        .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/ajustes')
    return data
}

/** Manda una notificación de prueba a todos los dispositivos del usuario. */
export async function sendTestNotification() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', user.id)

    if (!subs?.length) {
        throw new Error('No hay ningún dispositivo registrado todavía. Activá las notificaciones primero.')
    }

    const result = await sendPushToSubscriptions(subs, {
        title: 'Segundo Cerebro',
        body: 'Listo, las notificaciones funcionan. Así te va a llegar el recordatorio del compromiso.',
        url: '/',
        tag: 'test'
    })

    if (result.expired.length) {
        await supabase.from('push_subscriptions').delete().in('endpoint', result.expired)
    }

    if (!result.delivered) {
        throw new Error(result.errors[0] || 'No se pudo entregar a ningún dispositivo.')
    }

    revalidatePath('/ajustes')
    return { delivered: result.delivered, removed: result.expired.length }
}
