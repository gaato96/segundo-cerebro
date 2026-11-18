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

/**
 * Cache en memoria del proceso: evita repetir la sincronizacion (que escribe en la
 * base) en cada carga de pagina. Antes corria completa en cada render del dashboard.
 * Se resetea solo cuando cambia el dia o cuando el proceso arranca de cero.
 */
const lastSyncByUser = new Map<string, string>()

export async function syncRecurringTasks(userId?: string, force = false) {
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

    if (!force && lastSyncByUser.get(currentUserId) === todayStr) return
    lastSyncByUser.set(currentUserId, todayStr)

    // Todo en lote: antes eran 3-4 consultas seguidas por cada plantilla, y con
    // diez recurrentes la primera carga del día tardaba varios segundos.
    const { data: templates } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('is_recurring', true)
        .is('recurring_parent_id', null)

    if (templates?.length) {
        const ids = templates.map((t: any) => t.id)

        // 1. Las instancias pendientes que quedaron en el pasado pasan a 'Missed'
        await supabase
            .from('tasks')
            .update({ status: 'Missed', updated_at: new Date().toISOString() })
            .eq('user_id', currentUserId)
            .in('recurring_parent_id', ids)
            .in('status', ['Todo', 'InProgress'])
            .lt('due_date', todayStr)

        // 2. ¿Qué plantillas ya tienen una instancia activa de hoy en adelante?
        const { data: active } = await supabase
            .from('tasks')
            .select('recurring_parent_id')
            .eq('user_id', currentUserId)
            .in('recurring_parent_id', ids)
            .in('status', ['Todo', 'InProgress'])
            .gte('due_date', todayStr)
        const withActive = new Set((active || []).map((a: any) => a.recurring_parent_id))

        // 3. Para las que no, se calcula la próxima fecha
        const todayDate = new Date(`${todayStr}T00:00:00`)
        const candidates = templates
            .filter((t: any) => !withActive.has(t.id))
            .map((t: any) => ({
                template: t,
                date: formatDateStr(calculateNextOccurrenceDate(
                    todayDate, t.recurrence_type, t.recurrence_days || [], t.recurrence_interval || 1, true
                ))
            }))
            .filter(c => !c.template.recurrence_end_date || c.date <= c.template.recurrence_end_date)

        if (candidates.length) {
            // Evita duplicar una instancia que ya existe para esa fecha (por ejemplo, hecha hoy)
            const { data: sameDate } = await supabase
                .from('tasks')
                .select('recurring_parent_id, due_date')
                .eq('user_id', currentUserId)
                .in('recurring_parent_id', candidates.map(c => c.template.id))
                .in('due_date', Array.from(new Set(candidates.map(c => c.date))))
            const taken = new Set((sameDate || []).map((r: any) => `${r.recurring_parent_id}|${String(r.due_date).slice(0, 10)}`))
            const toCreate = candidates.filter(c => !taken.has(`${c.template.id}|${c.date}`))

            if (toCreate.length) {
                await supabase
                    .from('tasks')
                    .insert(toCreate.map(c => instanceFromTemplate(c.template, currentUserId!, c.date)))
                await Promise.all(toCreate.map(c =>
                    supabase.from('tasks').update({ next_occurrence_date: c.date }).eq('id', c.template.id)
                ))
            }
        }
    }

    await unstickOverdueTasks(supabase, currentUserId, todayStr)
}

/**
 * Tareas normales (no recurrentes) que quedaron planificadas para un día que
 * ya pasó sin completarse.
 *
 * Antes se quedaban ancladas a `planned_date` para siempre: no aparecían en
 * "pendientes de hoy" (esa fecha ya no es hoy) ni en el backlog del
 * planificador (`planned_date` no es null), y solo se las podía encontrar
 * navegando el planificador hasta la semana exacta en la que se planificaron.
 *
 * Esto las desancla: vuelven al backlog (`planned_date = null`) y, si no
 * tenían una fecha límite propia, el día planificado pasa a serlo —así
 * quedan visibles como vencidas en vez de perderse.
 */
async function unstickOverdueTasks(supabase: any, userId: string, todayStr: string) {
    const { data: stuck } = await supabase
        .from('tasks')
        .select('id, due_date, planned_date')
        .eq('user_id', userId)
        .in('status', ['Todo', 'InProgress'])
        .is('recurring_parent_id', null)
        .not('planned_date', 'is', null)
        .lt('planned_date', todayStr)

    for (const task of stuck || []) {
        await supabase
            .from('tasks')
            .update({
                planned_date: null,
                due_date: task.due_date || task.planned_date,
                updated_at: new Date().toISOString()
            })
            .eq('id', task.id)
            .eq('user_id', userId)
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
    const reminder_time = normalizeTime(formData.get('reminder_time') as string)

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
            reminder_time,
            next_occurrence_date: nextDateStr,
            status: 'Todo'
        })
        .select()
        .single()

    if (templateError) throw templateError

    // 2. Create the first active task instance for this recurring task
    const { error: instanceError } = await supabase
        .from('tasks')
        .insert(instanceFromTemplate(template, user.id, nextDateStr))

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
                    .insert(instanceFromTemplate(parent, user.id, nextDateStr))
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

/**
 * Edita una tarea recurrente "de acá en adelante".
 *
 * Cambia la plantilla y las instancias pendientes de hoy o posteriores. Las
 * instancias pasadas (hechas, perdidas o vencidas) quedan como estaban, así el
 * historial no se reescribe.
 */
export async function updateRecurringTask(templateId: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: template, error: fetchErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', templateId)
        .eq('user_id', user.id)
        .single()
    if (fetchErr || !template) throw new Error('Tarea recurrente no encontrada')

    const recurrence_days_str = formData.get('recurrence_days') as string
    const fields = {
        title: (formData.get('title') as string || '').trim() || template.title,
        description: (formData.get('description') as string) || null,
        priority: parseInt(formData.get('priority') as string) || template.priority,
        category: (formData.get('category') as string) || template.category,
        energy_level: (formData.get('energy_level') as string) || template.energy_level,
        reminder_time: normalizeTime(formData.get('reminder_time') as string)
    }
    const schedule = {
        recurrence_type: (formData.get('recurrence_type') as string) || template.recurrence_type,
        recurrence_days: recurrence_days_str ? recurrence_days_str.split(',').map(Number) : [],
        recurrence_interval: parseInt(formData.get('recurrence_interval') as string) || 1,
        recurrence_end_date: (formData.get('recurrence_end_date') as string) || null
    }

    const todayStr = getTodayStr()
    const scheduleChanged =
        schedule.recurrence_type !== template.recurrence_type ||
        (schedule.recurrence_interval || 1) !== (template.recurrence_interval || 1) ||
        [...schedule.recurrence_days].sort().join(',') !== [...(template.recurrence_days || [])].sort().join(',')

    const now = new Date().toISOString()

    // 1. La plantilla
    const { error: tplErr } = await supabase
        .from('tasks')
        .update({ ...fields, ...schedule, updated_at: now })
        .eq('id', templateId)
        .eq('user_id', user.id)
    if (tplErr) throw tplErr

    // 2. Instancias pendientes de hoy en adelante: heredan los cambios
    const { data: pending } = await supabase
        .from('tasks')
        .select('id, due_date')
        .eq('user_id', user.id)
        .eq('recurring_parent_id', templateId)
        .in('status', ['Todo', 'InProgress'])
        .gte('due_date', todayStr)
        .order('due_date', { ascending: true })

    if (pending?.length) {
        await supabase
            .from('tasks')
            .update({ ...fields, reminder_fired: false, updated_at: now })
            .in('id', pending.map(p => p.id))
            .eq('user_id', user.id)
    }

    // 3. Si cambió cuándo se repite, la próxima instancia se mueve a la nueva fecha
    if (scheduleChanged) {
        const nextStr = formatDateStr(calculateNextOccurrenceDate(
            new Date(`${todayStr}T00:00:00`),
            schedule.recurrence_type,
            schedule.recurrence_days,
            schedule.recurrence_interval,
            true
        ))
        const withinEnd = !schedule.recurrence_end_date || nextStr <= schedule.recurrence_end_date

        if (pending?.length) {
            const [first, ...rest] = pending
            if (rest.length) {
                await supabase.from('tasks').delete().in('id', rest.map(p => p.id)).eq('user_id', user.id)
            }
            if (withinEnd) {
                await supabase.from('tasks').update({ due_date: nextStr }).eq('id', first.id).eq('user_id', user.id)
            } else {
                await supabase.from('tasks').delete().eq('id', first.id).eq('user_id', user.id)
            }
        } else if (withinEnd) {
            await supabase.from('tasks').insert(instanceFromTemplate({ ...template, ...fields, id: templateId }, user.id, nextStr))
        }
        await supabase
            .from('tasks')
            .update({ next_occurrence_date: withinEnd ? nextStr : null })
            .eq('id', templateId)
            .eq('user_id', user.id)
    }

    revalidatePath('/tasks')
    revalidatePath('/')
}

/** "HH:MM" del input de hora -> "HH:MM:00" para la columna TIME (o null). */
function normalizeTime(value?: string | null): string | null {
    if (!value) return null
    const v = value.trim()
    if (!v) return null
    return v.length === 5 ? `${v}:00` : v
}

function getTodayStr(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date())
    const get = (t: string) => parts.find(p => p.type === t)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
}

/** Los campos que una instancia hereda de su plantilla recurrente. */
function instanceFromTemplate(template: any, userId: string, dueDate: string) {
    return {
        user_id: userId,
        title: template.title,
        description: template.description,
        priority: template.priority,
        category: template.category,
        energy_level: template.energy_level,
        reminder_time: template.reminder_time ?? null,
        due_date: dueDate,
        recurring_parent_id: template.id,
        status: 'Todo'
    }
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
