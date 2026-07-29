'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DreamItem {
    id: string
    user_id: string
    title: string
    description?: string | null
    category: 'Personal' | 'Professional' | 'Health' | 'Financial' | 'Relationships' | 'Adventure'
    status: 'Pending' | 'InProgress' | 'Achieved' | 'Deferred'
    target_year?: number | null
    image_url?: string | null
    created_at?: string
}

export async function getDreams(): Promise<DreamItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('dreams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching dreams:', error)
        return []
    }

    return data || []
}

export async function createDream(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const category = (formData.get('category') as any) || 'Personal'
    const status = (formData.get('status') as any) || 'Pending'
    const target_year = parseInt(formData.get('target_year') as string) || new Date().getFullYear()
    const image_url = (formData.get('image_url') as string) || null

    if (!title) return { error: 'El título es requerido' }

    const { error } = await supabase
        .from('dreams')
        .insert({
            user_id: user.id,
            title,
            description,
            category,
            status,
            target_year,
            image_url
        })

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}

export async function updateDream(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const category = (formData.get('category') as any) || 'Personal'
    const status = (formData.get('status') as any) || 'Pending'
    const target_year = parseInt(formData.get('target_year') as string) || new Date().getFullYear()

    const { error } = await supabase
        .from('dreams')
        .update({
            title,
            description,
            category,
            status,
            target_year
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}

export async function deleteDream(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('dreams')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}
