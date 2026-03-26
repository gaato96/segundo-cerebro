'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getWishlist() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', user.id)
        .order('desire_level', { ascending: false })

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
        })

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
