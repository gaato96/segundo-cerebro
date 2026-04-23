'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getStickyNotes() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('sticky_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('position_index', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createStickyNote(content: string = '', color: string = 'bg-yellow-200 text-yellow-900') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('sticky_notes')
        .insert({
            user_id: user.id,
            content,
            color,
            position_index: 0
        })
        .select()
        .single()

    if (error) throw error

    revalidatePath('/')
    return data
}

export async function updateStickyNote(id: string, updates: { content?: string; color?: string; position_index?: number }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('sticky_notes')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/')
}

export async function deleteStickyNote(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('sticky_notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/')
}
