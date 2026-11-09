'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateIdealRoutine(routine: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('profiles')
        .update({ ideal_routine_json: routine })
        .eq('id', user.id)

    if (error) {
        console.error('Error updating ideal routine:', error)
        return { error: 'Error al actualizar la rutina: ' + error.message }
    }

    revalidatePath('/')
    return { success: true }
}

// ============================================================
// MODO MÍNIMO
// ============================================================

/** Lee el modo mínimo. Si la migración 025 no corrió, vale false (todo visible). */
export async function getMinimalMode(): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data, error } = await supabase.from('profiles').select('minimal_mode').eq('id', user.id).maybeSingle()
    if (error) return false
    return Boolean(data?.minimal_mode)
}

export async function setMinimalMode(enabled: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }
    const { error } = await supabase.from('profiles').update({ minimal_mode: enabled }).eq('id', user.id)
    if (error) return { error: /minimal_mode/.test(error.message) ? 'Falta correr la migración 025 en Supabase.' : error.message }
    revalidatePath('/')
    revalidatePath('/ajustes')
    return { success: true }
}
