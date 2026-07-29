'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface JulianRecord {
    id: string
    user_id: string
    child_name: string
    category: 'Health' | 'Meds' | 'Vaccine' | 'Doc' | 'Note' | 'Appointment'
    title: string
    content?: string | null
    file_url?: string | null
    alert_date?: string | null
    dose_interval_hours?: number | null
    last_dose_at?: string | null
    weight_kg?: number | null
    height_cm?: number | null
    head_circ_cm?: number | null
    temperature?: number | null
    symptoms?: string[] | null
    milestone_type?: 'motor' | 'language' | 'social' | 'cognitive' | null
    created_at?: string
}

export async function getJulianRecords(): Promise<JulianRecord[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('child_registry')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching Julian records:', error)
        return []
    }

    return data || []
}

export async function createJulianRecord(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const category = (formData.get('category') as any) || 'Note'
    const content = (formData.get('content') as string) || null
    const alert_date = (formData.get('alert_date') as string) || null
    const dose_interval_hours = formData.get('dose_interval_hours') ? parseInt(formData.get('dose_interval_hours') as string) : null

    const weight_kg = formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null
    const height_cm = formData.get('height_cm') ? parseFloat(formData.get('height_cm') as string) : null
    const head_circ_cm = formData.get('head_circ_cm') ? parseFloat(formData.get('head_circ_cm') as string) : null
    const temperature = formData.get('temperature') ? parseFloat(formData.get('temperature') as string) : null
    const milestone_type = (formData.get('milestone_type') as any) || null

    if (!title) return { error: 'El título es requerido' }

    const { error } = await supabase
        .from('child_registry')
        .insert({
            user_id: user.id,
            child_name: 'Julian',
            category,
            title,
            content,
            alert_date,
            dose_interval_hours,
            last_dose_at: dose_interval_hours ? new Date().toISOString() : null,
            weight_kg,
            height_cm,
            head_circ_cm,
            temperature,
            milestone_type
        })

    if (error) return { error: error.message }

    revalidatePath('/julian')
    return { success: true }
}

export async function updateDoseTime(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('child_registry')
        .update({
            last_dose_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/julian')
    return { success: true }
}

export async function deleteJulianRecord(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('child_registry')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/julian')
    return { success: true }
}
