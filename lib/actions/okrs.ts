'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getObjectives() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: objectives, error: objError } = await supabase
        .from('objectives')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (objError) throw objError

    // Get all tasks linked to objectives for progress calculation
    const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, objective_id')
        .eq('user_id', user.id)
        .not('objective_id', 'is', null)

    if (tasksError) throw tasksError

    return { objectives: objectives || [], linkedTasks: tasks || [] }
}

export async function createObjective(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const description = formData.get('description') as string || ''
    const timeframe = formData.get('timeframe') as string
    const type = formData.get('type') as string
    const parent_id = formData.get('parent_id') as string || null

    const { error } = await supabase
        .from('objectives')
        .insert({
            user_id: user.id,
            title,
            description,
            timeframe,
            type,
            status: 'Active',
            parent_id: parent_id || null,
        })

    if (error) throw error
    revalidatePath('/okrs')
    revalidatePath('/')
}

export async function deleteObjective(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('objectives')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/okrs')
    revalidatePath('/')
}
