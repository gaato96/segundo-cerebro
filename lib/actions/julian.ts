'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getJulianRecords() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('child_registry')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createJulianRecord(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const category = formData.get('category') as string // Health, Meds, Vaccine, Doc, Note
    const content = formData.get('content') as string
    const dose_interval_hours = formData.get('dose_interval_hours')
        ? parseInt(formData.get('dose_interval_hours') as string)
        : null

    // File upload logic would go here, omitting for MVP to keep it simple textual

    const { error } = await supabase
        .from('child_registry')
        .insert({
            user_id: user.id,
            child_name: 'Julian', // Hardcoded for this specific user's app
            category,
            title,
            content,
            dose_interval_hours,
            last_dose_at: dose_interval_hours ? new Date().toISOString() : null
        })

    if (error) throw error
    revalidatePath('/julian')
}

export async function updateDoseTime(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('child_registry')
        .update({ last_dose_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/julian')
}

export async function deleteJulianRecord(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('child_registry')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/julian')
}
