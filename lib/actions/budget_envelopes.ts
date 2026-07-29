'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BudgetEnvelopeItem {
    id: string
    user_id: string
    month_year: string
    category: string
    allocated_amount: number
    spent_amount: number
    color_hex: string
    icon: string
    created_at?: string
}

export async function getEnvelopes(monthYear: string): Promise<BudgetEnvelopeItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('budget_envelopes')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .order('allocated_amount', { ascending: false })

    if (error) {
        console.error('Error fetching budget envelopes:', error)
        return []
    }

    return data || []
}

export async function createEnvelope(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const month_year = formData.get('month_year') as string
    const category = formData.get('category') as string
    const allocated_amount = parseFloat(formData.get('allocated_amount') as string) || 0
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'

    if (!month_year || !category) return { error: 'Mes y categoría son requeridos' }

    const { error } = await supabase
        .from('budget_envelopes')
        .upsert({
            user_id: user.id,
            month_year,
            category,
            allocated_amount,
            color_hex
        }, { onConflict: 'user_id,month_year,category' })

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function deleteEnvelope(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('budget_envelopes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}
