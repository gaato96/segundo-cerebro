'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await syncRecurringTasks(user.id)

    const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          objectives (title)
        `)
        .eq('user_id', user.id)
        .neq('status', 'Missed')
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
    const energy_level = formData.get('energy_level') as string || 'Deep Work'
    const reminderTimeStr = formData.get('reminder_time') as string

    const dueDate = dueDateStr ? new Date(dueDateStr).toISOString() : null
    const reminderTime = reminderTimeStr ? `${reminderTimeStr}:00` : null

    const { error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title,
            description,
            priority,
            category,
            energy_level,
            due_date: dueDate,
            reminder_time: reminderTime,
            reminder_fired: false,
            status: 'Todo'
        })

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/') // Dashboard
}

export async function createQuickTask(title: string, category: string = 'Personal') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    if (!title.trim()) return

    const { error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: title.trim(),
            priority: 2,
            category,
            energy_level: 'Deep Work',
            status: 'Todo'
        })

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
}

export async function updateTask(taskId: string, updates: {
    title?: string
    description?: string | null
    priority?: number
    category?: string
    energy_level?: string
    due_date?: string | null
    reminder_time?: string | null
    status?: 'Todo' | 'InProgress' | 'Done'
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const payload: any = {
        ...updates,
        updated_at: new Date().toISOString()
    }

    if (updates.due_date !== undefined) {
        payload.due_date = updates.due_date ? new Date(updates.due_date).toISOString() : null
    }

    if (updates.reminder_time !== undefined) {
        payload.reminder_time = updates.reminder_time ? (updates.reminder_time.length === 5 ? `${updates.reminder_time}:00` : updates.reminder_time) : null
    }

    const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', taskId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
}

export async function updateTaskStatus(taskId: string, status: 'Todo' | 'InProgress' | 'Done') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Check if it's a recurring instance task
    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

    if (task && task.recurring_parent_id && status === 'Done') {
        await completeRecurringInstance(taskId)
        return
    }

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

// ============================================================
// SUBTASKS
// ============================================================

export async function getSubtasks(parentTaskId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('parent_task_id', parentTaskId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createSubtask(parentTaskId: string, title: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title,
            parent_task_id: parentTaskId,
            status: 'Todo',
            priority: 2,
            category: 'Personal'
        })

    if (error) throw error
    revalidatePath('/tasks')
}

export async function toggleSubtask(subtaskId: string, currentStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const newStatus = currentStatus === 'Done' ? 'Todo' : 'Done'
    const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subtaskId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
}

export async function deleteSubtask(subtaskId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
}

// ============================================================
// RECURRING TASKS
// ============================================================

export async function syncRecurringTasks(userId?: string) {
    const supabase = await createClient()
    let currentUserId = userId
    if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        currentUserId = user.id
    }

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    })
    const parts = formatter.formatToParts(now)
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    const todayStr = `${y}-${m}-${d}`

    // 1. Get all recurring templates for user
    const { data: templates } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('is_recurring', true)
        .is('recurring_parent_id', null)

    if (!templates || templates.length === 0) return

    for (const template of templates) {
        // 2. Mark overdue pending instances for this template as 'Missed'
        await supabase
            .from('tasks')
            .update({ status: 'Missed', updated_at: new Date().toISOString() })
            .eq('user_id', currentUserId)
            .eq('recurring_parent_id', template.id)
            .in('status', ['Todo', 'InProgress'])
            .lt('due_date', todayStr)

        // 3. Check if an active instance (status Todo or InProgress) for due_date >= todayStr already exists
        const { data: activeInstances } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('recurring_parent_id', template.id)
            .in('status', ['Todo', 'InProgress'])
            .gte('due_date', todayStr)

        if (!activeInstances || activeInstances.length === 0) {
            // No active instance for today or future! Generate the next one!
            const todayDate = new Date(`${todayStr}T00:00:00`)
            const nextDate = calculateNextOccurrenceDate(
                todayDate,
                template.recurrence_type,
                template.recurrence_days || [],
                template.recurrence_interval || 1,
                true
            )

            const nextDateStr = formatDateStr(nextDate)

            // Verify end date
            if (!template.recurrence_end_date || nextDateStr <= template.recurrence_end_date) {
                // Double check if any instance for this exact due_date already exists
                const { data: existingSameDate } = await supabase
                    .from('tasks')
                    .select('id')
                    .eq('user_id', currentUserId)
                    .eq('recurring_parent_id', template.id)
                    .eq('due_date', nextDateStr)
                    .limit(1)

                if (!existingSameDate || existingSameDate.length === 0) {
                    await supabase
                        .from('tasks')
                        .insert({
                            user_id: currentUserId,
                            title: template.title,
                            description: template.description,
                            priority: template.priority,
                            category: template.category,
                            energy_level: template.energy_level,
                            due_date: nextDateStr,
                            recurring_parent_id: template.id,
                            status: 'Todo'
                        })

                    await supabase
                        .from('tasks')
                        .update({ next_occurrence_date: nextDateStr })
                        .eq('id', template.id)
                }
            }
        }
    }
}

export async function getRecurringTasks() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await syncRecurringTasks(user.id)

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .is('recurring_parent_id', null)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createRecurringTask(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priority = parseInt(formData.get('priority') as string) || 2
    const category = formData.get('category') as string || 'Personal'
    const energy_level = formData.get('energy_level') as string || 'Deep Work'
    
    const recurrence_type = formData.get('recurrence_type') as string || 'weekly'
    const recurrence_days_str = formData.get('recurrence_days') as string // "1,3,5"
    const recurrence_days = recurrence_days_str ? recurrence_days_str.split(',').map(Number) : []
    const recurrence_interval = parseInt(formData.get('recurrence_interval') as string) || 1
    const recurrence_end_date = formData.get('recurrence_end_date') as string || null

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    })
    const parts = formatter.formatToParts(now)
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    const todayDate = new Date(`${y}-${m}-${d}T00:00:00`)

    // Calculate initial next occurrence date (includeToday = true)
    const nextDate = calculateNextOccurrenceDate(todayDate, recurrence_type, recurrence_days, recurrence_interval, true)
    const nextDateStr = formatDateStr(nextDate)

    // 1. Create recurring template task
    const { data: template, error: templateError } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title,
            description,
            priority,
            category,
            energy_level,
            is_recurring: true,
            recurrence_type,
            recurrence_days,
            recurrence_interval,
            recurrence_end_date: recurrence_end_date ? recurrence_end_date : null,
            next_occurrence_date: nextDateStr,
            status: 'Todo'
        })
        .select()
        .single()

    if (templateError) throw templateError

    // 2. Create the first active task instance for this recurring task
    const { error: instanceError } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title,
            description,
            priority,
            category,
            energy_level,
            due_date: nextDateStr,
            recurring_parent_id: template.id,
            status: 'Todo'
        })

    if (instanceError) throw instanceError

    revalidatePath('/tasks')
    revalidatePath('/')
}

export async function completeRecurringInstance(taskId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Get task instance
    const { data: task, error: fetchErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

    if (fetchErr || !task) throw new Error('Task not found')

    // 2. Mark current instance as Done
    await supabase
        .from('tasks')
        .update({ status: 'Done', updated_at: new Date().toISOString() })
        .eq('id', taskId)

    // 3. If it has a parent template, generate the next instance!
    if (task.recurring_parent_id) {
        const { data: parent } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', task.recurring_parent_id)
            .single()

        if (parent && parent.is_recurring) {
            // Check end date limit starting after task.due_date
            const baseDate = task.due_date ? new Date(`${task.due_date}T00:00:00`) : new Date()
            const nextDate = calculateNextOccurrenceDate(baseDate, parent.recurrence_type, parent.recurrence_days || [], parent.recurrence_interval || 1, false)
            const nextDateStr = formatDateStr(nextDate)
            
            if (!parent.recurrence_end_date || nextDateStr <= parent.recurrence_end_date) {
                // Update parent next_occurrence_date
                await supabase
                    .from('tasks')
                    .update({ next_occurrence_date: nextDateStr })
                    .eq('id', parent.id)

                // Create next task instance
                await supabase
                    .from('tasks')
                    .insert({
                        user_id: user.id,
                        title: parent.title,
                        description: parent.description,
                        priority: parent.priority,
                        category: parent.category,
                        energy_level: parent.energy_level,
                        due_date: nextDateStr,
                        recurring_parent_id: parent.id,
                        status: 'Todo'
                    })
            }
        }
    }

    revalidatePath('/tasks')
    revalidatePath('/')
}

export async function deleteRecurringTask(recurringParentId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Delete parent template and associated pending instances
    const { error } = await supabase
        .from('tasks')
        .delete()
        .or(`id.eq.${recurringParentId},recurring_parent_id.eq.${recurringParentId}`)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
}

function formatDateStr(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Helper: Calculate next occurrence date
function calculateNextOccurrenceDate(from: Date, type: string, days: number[], interval: number = 1, includeToday: boolean = false): Date {
    const next = new Date(from.getTime())
    next.setHours(0, 0, 0, 0)
    const startOffset = includeToday ? 0 : 1

    if (type === 'daily') {
        if (includeToday) return next
        next.setDate(next.getDate() + interval)
    } else if (type === 'weekly') {
        if (days && days.length > 0) {
            for (let i = startOffset; i <= 7 * interval; i++) {
                const check = new Date(next.getTime())
                check.setDate(check.getDate() + i)
                let isoDay = check.getDay()
                if (isoDay === 0) isoDay = 7
                if (days.includes(isoDay)) {
                    return check
                }
            }
        }
        next.setDate(next.getDate() + (includeToday ? 0 : 7 * interval))
    } else if (type === 'biweekly') {
        if (includeToday) return next
        next.setDate(next.getDate() + 14 * interval)
    } else if (type === 'monthly') {
        if (includeToday) return next
        next.setMonth(next.getMonth() + interval)
    } else if (type === 'quarterly') {
        if (includeToday) return next
        next.setMonth(next.getMonth() + 3 * interval)
    } else {
        if (includeToday) return next
        next.setDate(next.getDate() + 1)
    }

    return next
}
