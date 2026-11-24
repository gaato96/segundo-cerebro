'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocalMonthYearStr } from '@/lib/utils'

// type: 'Income' | 'Fixed_Expense' | 'Variable' | 'Debt_Payment'
//
// El alta y la edicion de deudas vive en lib/actions/debts.ts: ahi estan la
// tasa real, los planes de pago y las observaciones de saldo.

export async function getFinances(monthYear: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get transactions for the month
    const txQuery = supabase
        .from('finances')
        .select(`
      *,
      debts (creditor)
    `)
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .order('created_at', { ascending: false })

    // Get all active debts
    const debtsQuery = supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .gt('remaining_amount', 0)
        .order('remaining_amount', { ascending: true })

    const budgetQuery = supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .maybeSingle()

    const goalsQuery = supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    // Las cuatro a la vez: antes eran cuatro viajes seguidos a la base.
    const [
        { data: transactions, error: txError }, { data: debts, error: debtsError },
        { data: budget, error: budgetError }, { data: goals, error: goalsError }
    ] = await Promise.all([txQuery, debtsQuery, budgetQuery, goalsQuery])

    if (txError) throw txError
    if (debtsError) throw debtsError
    if (budgetError && budgetError.code !== 'PGRST116') throw budgetError
    if (goalsError) throw goalsError

    return {
        transactions: transactions || [],
        debts: debts || [],
        budget: budget || null,
        goals: goals || []
    }
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

    // Mes en hora argentina: con la hora del servidor (UTC) un gasto de las 22 h
    // del último día del mes caía en el mes siguiente.
    const monthYear = getLocalMonthYearStr()

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

// ==========================================
// BUDGETS & GOALS
// ==========================================
export async function saveMonthlyBudget(monthYear: string, incomesJson: string, expensesJson: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let incomes = []
    let expenses = []
    try {
        incomes = JSON.parse(incomesJson)
        expenses = JSON.parse(expensesJson)
    } catch (e) { }

    const { error } = await supabase
        .from('monthly_budgets')
        .upsert({
            user_id: user.id,
            month_year: monthYear,
            incomes_json: incomes,
            expenses_json: expenses
        }, { onConflict: 'user_id,month_year' })

    if (error) {
        console.error('Error saving budget:', error);
        throw error;
    }
    revalidatePath('/finances')
}

export async function createFinancialGoal(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const target_amount = parseFloat(formData.get('target_amount') as string)
    const target_date_str = formData.get('target_date') as string
    const target_date = target_date_str ? target_date_str : null
    const color_hex = formData.get('color_hex') as string || '#10b981'

    const { error } = await supabase
        .from('financial_goals')
        .insert({
            user_id: user.id,
            title,
            target_amount,
            current_amount: 0,
            target_date,
            color_hex
        })

    if (error) throw error
    revalidatePath('/finances')
}

export async function updateFinancialGoal(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const current_amount = parseFloat(formData.get('current_amount') as string)

    const { error } = await supabase
        .from('financial_goals')
        .update({ current_amount })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/finances')
}

export async function deleteFinancialGoal(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('financial_goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/finances')
}
