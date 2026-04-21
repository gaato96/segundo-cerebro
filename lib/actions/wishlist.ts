'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// WISHLIST LISTS (parent groupings)
// ============================================================

export async function getWishlistLists() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createWishlistList(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const name = (formData.get('name') as string)?.trim()
    const icon = (formData.get('icon') as string)?.trim() || '📋'

    if (!name) throw new Error('Name is required')

    // Get next position
    const { data: existing } = await supabase
        .from('wishlist_lists')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)

    const nextPos = existing && existing.length > 0 ? existing[0].position + 1 : 0

    const { error } = await supabase
        .from('wishlist_lists')
        .insert({
            user_id: user.id,
            name,
            icon,
            position: nextPos,
        })

    if (error) throw error
    revalidatePath('/wishlist')
}

export async function updateWishlistList(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const name = (formData.get('name') as string)?.trim()
    const icon = (formData.get('icon') as string)?.trim()

    const updates: Record<string, string> = {}
    if (name) updates.name = name
    if (icon) updates.icon = icon

    const { error } = await supabase
        .from('wishlist_lists')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/wishlist')
}

export async function deleteWishlistList(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('wishlist_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/wishlist')
}

// ============================================================
// WISHLIST ITEMS
// ============================================================

export async function getWishlist(listId?: string | null) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let query = supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', user.id)
        .order('desire_level', { ascending: false })

    if (listId === 'general') {
        query = query.is('list_id', null)
    } else if (listId) {
        query = query.eq('list_id', listId)
    }
    // If no listId, return ALL items (for stats, etc.)

    const { data, error } = await query

    if (error) throw error
    return data || []
}

export async function createWish(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string) || 0
    const url = formData.get('url') as string || ''
    const category = formData.get('category') as string || 'General'
    const desire_level = parseInt(formData.get('desire_level') as string) || 3
    const list_id = formData.get('list_id') as string || null

    const { error } = await supabase
        .from('wishlist')
        .insert({
            user_id: user.id,
            name,
            price,
            url,
            category,
            desire_level,
            linked_to_budget: false,
            list_id: list_id || null,
        })

    if (error) throw error
    revalidatePath('/wishlist')
}

export async function toggleWishPurchased(id: string, purchased: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('wishlist')
        .update({ purchased })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/wishlist')
}

export async function deleteWish(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/wishlist')
}
