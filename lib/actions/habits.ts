'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getHabits() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get habits
    const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (habitsError) throw habitsError

    // Get all logs for current week (last 7 days) to calculate streaks/progress
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: logs, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString())

    if (logsError) throw logsError

    return { habits: habits || [], logs: logs || [] }
}

export async function createHabit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const frequency = formData.get('frequency') as string || 'daily'
    const goalCount = parseInt(formData.get('goal_count') as string) || 1
    const colorHex = formData.get('color_hex') as string || '#6366f1'

    const { error } = await supabase
        .from('habits')
        .insert({
            user_id: user.id,
            title,
            frequency,
            goal_count: goalCount,
            color_hex: colorHex
        })

    if (error) throw error
    revalidatePath('/habits')
    revalidatePath('/')
}

export async function deleteHabit(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/habits')
    revalidatePath('/')
}
