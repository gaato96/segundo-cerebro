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
