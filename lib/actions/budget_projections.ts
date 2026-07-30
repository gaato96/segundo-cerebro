'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BudgetProjectionItem {
    id: string
    user_id: string
    month_year: string
    type: 'income' | 'expense'
    description: string
    amount: number
    category: string | null
    created_at: string
}

export async function getBudgetProjections(monthYear: string): Promise<BudgetProjectionItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('budget_projections')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .order('type', { ascending: false })       // income first
        .order('amount', { ascending: false })

    if (error) {
        console.error('Error fetching budget projections:', error)
        return []
    }
    return data || []
}

export async function createBudgetProjection(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const month_year = formData.get('month_year') as string
    const type = formData.get('type') as 'income' | 'expense'
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const category = (formData.get('category') as string) || null

    if (!month_year || !type || !description || isNaN(amount)) {
        return { error: 'Datos incompletos' }
    }

    const { error } = await supabase
        .from('budget_projections')
        .insert({ user_id: user.id, month_year, type, description, amount, category })

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function deleteBudgetProjection(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('budget_projections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function updateBudgetProjection(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const category = (formData.get('category') as string) || null

    const { error } = await supabase
        .from('budget_projections')
        .update({ description, amount, category })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}
