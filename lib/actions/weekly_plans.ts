'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface WeeklyPlanItem {
    id: string
    user_id: string
    week_start_date: string
    plan_data: Record<string, string[]> // { "YYYY-MM-DD": [taskId1, taskId2] }
    weekly_goals?: string | null
    reflection?: string | null
}

export async function getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlanItem | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartDate)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching weekly plan:', error)
    }

    return data || null
}

export async function saveWeeklyPlan(weekStartDate: string, planData: Record<string, string[]>, weeklyGoals?: string, reflection?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('weekly_plans')
        .upsert({
            user_id: user.id,
            week_start_date: weekStartDate,
            plan_data: planData,
            weekly_goals: weeklyGoals || null,
            reflection: reflection || null
        }, { onConflict: 'user_id,week_start_date' })

    if (error) return { error: error.message }

    revalidatePath('/planner')
    return { success: true }
}

export async function assignTaskToDay(taskId: string, plannedDate: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('tasks')
        .update({ planned_date: plannedDate, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/planner')
    revalidatePath('/tasks')
    revalidatePath('/')
    return { success: true }
}

export async function unassignTaskFromDay(taskId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('tasks')
        .update({ planned_date: null, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/planner')
    revalidatePath('/tasks')
    return { success: true }
}

export async function getUnplannedTasks() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'Done')
        .is('planned_date', null)
        .order('priority', { ascending: true })

    if (error) {
        console.error('Error fetching unplanned tasks:', error)
        return []
    }
    return data || []
}
