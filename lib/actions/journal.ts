'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getJournalEntry(date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

    if (error && error.code !== 'PGRST116') throw error // Ignore "not found"
    return data
}

export async function saveJournalEntry(date: string, content: string, mood?: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Check if exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

    if (existing) {
        // Update
        const { error } = await supabase
            .from('journal_entries')
            .update({
                content,
                ...(mood && { mood }),
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

        if (error) throw error
    } else {
        // Insert
        const { error } = await supabase
            .from('journal_entries')
            .insert({
                user_id: user.id,
                date,
                content,
                mood,
            })

        if (error) throw error
    }

    revalidatePath('/journal')
}
