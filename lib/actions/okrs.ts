'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ObjectiveItem {
    id: string
    user_id: string
    title: string
    description?: string | null
    timeframe: 'Year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
    type: 'Professional' | 'Personal'
    status: 'Active' | 'Completed' | 'Cancelled'
    parent_id?: string | null
    dream_id?: string | null
    progress_pct: number
    notes?: string | null
    priority?: number
    created_at?: string
}

export async function getObjectives() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { objectives: [], linkedTasks: {} }

    const { data: objectives, error: objError } = await supabase
        .from('objectives')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (objError) {
        console.error('Error fetching objectives:', objError)
    }

    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('objective_id', 'is', null)

    if (taskError) {
        console.error('Error fetching linked tasks:', taskError)
    }

    const linkedTasks: Record<string, any[]> = {}
    tasks?.forEach((t) => {
        if (t.objective_id) {
            if (!linkedTasks[t.objective_id]) linkedTasks[t.objective_id] = []
            linkedTasks[t.objective_id].push(t)
        }
    })

    return {
        objectives: (objectives || []) as ObjectiveItem[],
        linkedTasks
    }
}

export async function createObjective(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const timeframe = (formData.get('timeframe') as any) || 'Year'
    const type = (formData.get('type') as any) || 'Personal'
    const dream_id = (formData.get('dream_id') as string) || null
    const progress_pct = parseInt(formData.get('progress_pct') as string) || 0

    if (!title) return { error: 'El título es requerido' }

    const { error } = await supabase
        .from('objectives')
        .insert({
            user_id: user.id,
            title,
            description,
            timeframe,
            type,
            status: 'Active',
            dream_id,
            progress_pct
        })

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}

export async function updateObjectiveProgress(id: string, progress_pct: number, status?: 'Active' | 'Completed' | 'Cancelled') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const updates: any = { progress_pct }
    if (status) updates.status = status
    if (progress_pct >= 100) updates.status = 'Completed'

    const { error } = await supabase
        .from('objectives')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}

export async function deleteObjective(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('objectives')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true }
}
