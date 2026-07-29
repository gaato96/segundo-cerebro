'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface HabitItem {
    id: string
    user_id: string
    title: string
    frequency: 'daily' | 'weekly'
    goal_count: number
    color_hex: string
    objective_id?: string | null
    estimated_minutes: number
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
    order_index: number
    icon: string
    is_active: boolean
    created_at?: string
}

export interface HabitLogItem {
    id: string
    habit_id: string
    user_id: string
    completed_at: string
    note?: string | null
}

export async function getHabitsWithStats(monthYear?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { habits: [], logs: [], monthlyStats: { streak: 0, completionRate: 0 } }

    const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('time_of_day', { ascending: true })
        .order('estimated_minutes', { ascending: true })

    if (habitsError) {
        console.error('Error fetching habits:', habitsError)
    }

    const { data: logs, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)

    if (logsError) {
        console.error('Error fetching habit logs:', logsError)
    }

    const habitsList = habits || []
    const logsList = logs || []

    // Calculate monthly stats
    const now = new Date()
    const currentMonthPrefix = monthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const monthLogs = logsList.filter(l => l.completed_at.startsWith(currentMonthPrefix))

    // Completion rate
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const possibleCompletions = (habitsList.length || 1) * daysInMonth
    const completionRate = Math.min(100, Math.round((monthLogs.length / possibleCompletions) * 100))

    return {
        habits: habitsList as HabitItem[],
        logs: logsList as HabitLogItem[],
        monthlyStats: {
            completionRate,
            activeHabitsCount: habitsList.filter(h => h.is_active).length,
            totalLogsMonth: monthLogs.length
        }
    }
}

export async function createHabit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const frequency = (formData.get('frequency') as 'daily' | 'weekly') || 'daily'
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const estimated_minutes = parseInt(formData.get('estimated_minutes') as string) || 15
    const time_of_day = (formData.get('time_of_day') as any) || 'morning'
    const icon = (formData.get('icon') as string) || 'flame'

    if (!title) return { error: 'El título es requerido' }

    const { error } = await supabase
        .from('habits')
        .insert({
            user_id: user.id,
            title,
            frequency,
            goal_count: 1,
            color_hex,
            estimated_minutes,
            time_of_day,
            icon,
            is_active: true
        })

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

export async function updateHabit(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const frequency = (formData.get('frequency') as 'daily' | 'weekly') || 'daily'
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const estimated_minutes = parseInt(formData.get('estimated_minutes') as string) || 15
    const time_of_day = (formData.get('time_of_day') as any) || 'morning'
    const icon = (formData.get('icon') as string) || 'flame'

    const { error } = await supabase
        .from('habits')
        .update({
            title,
            frequency,
            color_hex,
            estimated_minutes,
            time_of_day,
            icon
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

export async function deleteHabit(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}
