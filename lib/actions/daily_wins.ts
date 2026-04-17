'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getDailyWin(dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle()

    if (error && error.code !== 'PGRST116') {
        throw error
    }

    return data
}

export async function saveDailyWin(win: string, dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Upsert the daily win for the specific date
    const { data, error } = await supabase
        .from('daily_wins')
        .upsert(
            {
                user_id: user.id,
                date: dateStr,
                win,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id,date' }
        )
        .select()
        .single()

    if (error) throw error

    revalidatePath('/')
    return data
}
