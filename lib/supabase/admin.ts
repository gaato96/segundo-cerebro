import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase con service-role.
 *
 * SALTEA RLS: usar SOLO en rutas de servidor que no tienen sesión de usuario
 * (el cron de notificaciones). Nunca importar esto desde un componente cliente.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error(
            'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno. ' +
            'Se consigue en Supabase > Settings > API > service_role. ' +
            'Sin eso el cron no puede leer los datos de los usuarios.'
        )
    }

    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
}

export function hasAdminCredentials(): boolean {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
