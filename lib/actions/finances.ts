'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// type: 'Income' | 'Fixed_Expense' | 'Variable' | 'Debt_Payment'

export async function getFinances(monthYear: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get transactions for the month
    const { data: transactions, error: txError } = await supabase
        .from('finances')
        .select(`
      *,
      debts (creditor)
    `)
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .order('created_at', { ascending: false })

    if (txError) throw txError

    // Get all active debts
    const { data: debts, error: debtsError } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .gt('remaining_amount', 0)
        .order('due_day', { ascending: true })

    if (debtsError) throw debtsError

    return { transactions: transactions || [], debts: debts || [] }
}

export async function createTransaction(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const type = formData.get('type') as string
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const category = formData.get('category') as string || 'General'
    const is_recurring = formData.get('is_recurring') === 'true'
    const due_day = formData.get('due_day') ? parseInt(formData.get('due_day') as string) : null
    const debt_id = formData.get('debt_id') as string || null

    // Use current local month-year (e.g., "2026-03")
    const date = new Date()
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const { error } = await supabase
        .from('finances')
        .insert({
            user_id: user.id,
            type,
            description,
            amount,
            category,
            is_recurring,
            due_day,
            debt_id,
            month_year: monthYear
        })

    if (error) throw error
    revalidatePath('/finances')
}

export async function createDebt(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const creditor = formData.get('creditor') as string
    const total_amount = parseFloat(formData.get('total_amount') as string)
    const interest_rate = parseFloat(formData.get('interest_rate') as string) || 0
    const due_day = parseInt(formData.get('due_day') as string)

    const { error } = await supabase
        .from('debts')
        .insert({
            user_id: user.id,
            creditor,
            total_amount,
            remaining_amount: total_amount, // initially, remaining = total
            interest_rate,
            due_day
        })

    if (error) throw error
    revalidatePath('/finances')
}

export async function deleteTransaction(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/finances')
}
