/**
 * Resultado de una server action que puede fallar por algo esperable
 * (falta una API key, la IA no respondió, Supabase devolvió error).
 *
 * En producción Next.js reemplaza el mensaje de cualquier error que se escape
 * de una server action por "An error occurred in the Server Components render…",
 * así que el motivo real nunca llega a la pantalla. La solución es no dejar que
 * el error se escape: devolverlo como dato.
 *
 * Este archivo NO lleva 'use server' a propósito: en esos módulos todo lo que se
 * exporta tiene que ser una función async, y acá exportamos tipos y un helper.
 */

export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string }

/** Convierte cualquier cosa que se haya tirado en un mensaje legible. */
export function errorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message
    if (typeof e === 'string' && e.trim()) return e
    const message = (e as any)?.message
    if (typeof message === 'string' && message.trim()) return message
    return 'Error desconocido en el servidor.'
}

/**
 * Corre la acción y captura cualquier error para que llegue al cliente como texto.
 * `label` es lo que se loguea en el servidor (Vercel > Logs) para poder rastrearlo.
 */
export async function runAction<T>(label: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
    try {
        return { ok: true, data: await fn() }
    } catch (e) {
        const error = errorMessage(e)
        console.error(`[action:${label}]`, e)
        return { ok: false, error }
    }
}
