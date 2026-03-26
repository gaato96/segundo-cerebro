'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('tasks')
        .select(`
      *,
      objectives (title)
    `)
        .eq('user_id', user.id)
        .order('status', { ascending: true }) // Todo, InProgress, Done
        .order('priority', { ascending: true }) // 1, 2, 3
        .order('due_date', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data
}

export async function createTask(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priority = parseInt(formData.get('priority') as string) || 2
    const category = formData.get('category') as string || 'Personal'
    const dueDateStr = formData.get('due_date') as string

    const dueDate = dueDateStr ? new Date(dueDateStr).toISOString() : null

    const { error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title,
            description,
            priority,
            category,
            due_date: dueDate,
            status: 'Todo'
        })

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/') // Dashboard
}

export async function updateTaskStatus(taskId: string, status: 'Todo' | 'InProgress' | 'Done') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('tasks')
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
}

export async function deleteTask(taskId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
}
