'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface MorningRitualLog {
    id: string
    user_id: string
    date: string
    daily_objective?: string | null
    affirmation?: string | null
    completed_at?: string
}

export async function getRitualConfig() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('morning_ritual_config')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching ritual config:', error)
    }

    return data || {
        sections_order: ['daily_objective', 'pending_tasks', 'habits', 'inbox_unread', 'events_today', 'affirmation'],
        daily_objective_prompt: '¿Cuál es tu objetivo #1 de hoy?',
        show_affirmation: true
    }
}

export async function getRitualLog(dateStr: string): Promise<MorningRitualLog | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('morning_ritual_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching ritual log:', error)
    }

    return data || null
}

export async function saveRitualLog(dateStr: string, dailyObjective: string, affirmation?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data, error } = await supabase
        .from('morning_ritual_logs')
        .upsert({
            user_id: user.id,
            date: dateStr,
            daily_objective: dailyObjective,
            affirmation: affirmation || null,
            completed_at: new Date().toISOString()
        }, { onConflict: 'user_id,date' })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true, log: data }
}

export async function saveRitualConfig(sectionsOrder: string[], promptText: string, showAffirmation: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('morning_ritual_config')
        .upsert({
            user_id: user.id,
            sections_order: sectionsOrder,
            daily_objective_prompt: promptText,
            show_affirmation: showAffirmation
        }, { onConflict: 'user_id' })

    if (error) return { error: error.message }

    revalidatePath('/ritual')
    return { success: true }
}

export async function getMorningData(dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [tasksRes, habitsRes, inboxRes, eventsRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .neq('status', 'Done')
            .or(`due_date.lte.${dateStr},planned_date.eq.${dateStr},due_date.is.null`)
            .order('priority', { ascending: true }),

        supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true),

        supabase
            .from('mental_notes')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_processed', false),

        supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('event_date', dateStr)
            .order('start_time', { ascending: true, nullsFirst: true })
    ])

    return {
        tasks: tasksRes.data || [],
        habits: habitsRes.data || [],
        inboxUnreadCount: inboxRes.data?.length || 0,
        events: eventsRes.data || []
    }
}
