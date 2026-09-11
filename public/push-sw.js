/* eslint-disable no-undef */
/**
 * Service worker de notificaciones del Segundo Cerebro.
 *
 * Se sirve como archivo estático y se registra a mano desde la app
 * (components/notifications/NotificationSettings.tsx).
 *
 * Va aparte de next-pwa a propósito: next-pwa v5 es un plugin de webpack y no
 * se ejecuta en los builds con Turbopack, así que no se puede confiar en que
 * regenere el sw.js con nuestros handlers adentro.
 *
 * No registra ningún handler de `fetch`, así que no toca el comportamiento de red.
 */

const ICON = '/icons/icon-192x192.png'

self.addEventListener('install', () => {
    // Reemplaza la versión anterior sin esperar a que se cierren las pestañas.
    self.skipWaiting()
})

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
    if (!event.data) return

    let payload
    try {
        payload = event.data.json()
    } catch (e) {
        payload = { title: 'Segundo Cerebro', body: event.data.text() }
    }

    const title = payload.title || 'Segundo Cerebro'
    const options = {
        body: payload.body || '',
        icon: payload.icon || ICON,
        badge: payload.badge || ICON,
        // Un tag repetido reemplaza la notificación anterior en vez de apilar ruido.
        tag: payload.tag || 'segundo-cerebro',
        renotify: Boolean(payload.renotify),
        requireInteraction: Boolean(payload.requireInteraction),
        data: Object.assign({ url: payload.url || '/' }, payload.data || {}),
        actions: payload.actions || []
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
    event.notification.close()

    const target = (event.action && event.action.charAt(0) === '/')
        ? event.action
        : (event.notification.data && event.notification.data.url) || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Si la app ya está abierta, la enfocamos en vez de abrir otra pestaña.
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus()
                    if ('navigate' in client) client.navigate(target)
                    return undefined
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(target)
            return undefined
        })
    )
})
