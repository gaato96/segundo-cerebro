'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPendingMentalNotes() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('mental_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_processed', false)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createMentalNote(content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('mental_notes')
        .insert({
            user_id: user.id,
            content,
            is_processed: false
        })
        .select()
        .single()

    if (error) throw error

    revalidatePath('/')
    return data
}

export async function processMentalNote(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('mental_notes')
        .update({
            is_processed: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/')
}

export async function deleteMentalNote(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('mental_notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/')
}
