'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMediaBacklog() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('media_backlog')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createMediaItem(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const status = formData.get('status') as string || 'Backlog'

    const { error } = await supabase
        .from('media_backlog')
        .insert({
            user_id: user.id,
            title,
            type,
            status,
            // Optional defaults
            progress: '',
            rating: null,
            notes: ''
        })

    if (error) throw error
    revalidatePath('/media')
}

export async function updateMediaStatus(id: string, newStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function updateMediaProgress(id: string, progress: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .update({ progress })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function deleteMediaItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}
