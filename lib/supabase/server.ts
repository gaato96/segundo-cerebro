import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

async function createBaseClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch (error) {
                        // The `setAll` method is called from a Server Component.
                    }
                },
            },
        }
    )
}

/**
 * El proyecto firma los JWT con ES256: `getClaims` verifica la firma acá mismo
 * con la clave pública (cacheada), sin el viaje de ~170 ms al servidor de Auth
 * en cada pantalla. Las reglas RLS de la base siguen validando el token igual.
 *
 * `auth.getUser()` es una llamada de red al servidor de Auth de Supabase.
 * Una sola página llamaba a muchas acciones, y cada una pedía el usuario de
 * nuevo: el dashboard hacía más de diez viajes seguidos solo para saber quién
 * sos. `cache` de React lo resuelve una vez por request y lo comparte.
 */
const getUserOncePerRequest = cache(async () => {
    const client = await createBaseClient()
    const { data, error } = await client.auth.getClaims()
    const claims = data?.claims
    if (claims?.sub) {
        return {
            data: { user: { id: claims.sub, email: claims.email, app_metadata: claims.app_metadata || {}, user_metadata: claims.user_metadata || {}, aud: 'authenticated', created_at: '' } as User },
            error: null
        }
    }
    if (error) return client.auth.getUser()
    return { data: { user: null }, error: null }
})

export async function createClient() {
    const client = await createBaseClient()
    const original = client.auth.getUser.bind(client.auth)
    // Con un JWT explícito se respeta la llamada original.
    client.auth.getUser = ((jwt?: string) =>
        jwt ? original(jwt) : getUserOncePerRequest()) as unknown as typeof client.auth.getUser
    return client
}
