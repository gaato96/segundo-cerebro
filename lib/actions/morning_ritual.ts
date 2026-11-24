'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { syncRecurringTasks } from '@/lib/actions/tasks'
import { addDaysToDateStr, isHabitScheduledForDate } from '@/lib/utils'

export interface MorningRitualLog {
    id: string
    user_id: string
    date: string
    daily_objective?: string | null
    affirmation?: string | null
    mit_task_ids?: string[]
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

export async function saveRitualLog(dateStr: string, dailyObjective: string, affirmation?: string, mitTaskIds: string[] = []) {
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
            mit_task_ids: mitTaskIds,
            completed_at: new Date().toISOString()
        }, { onConflict: 'user_id,date' })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true, log: data }
}

export async function saveRitualDraft(dateStr: string, dailyObjective: string, affirmation?: string, mitTaskIds: string[] = []) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const fields = { daily_objective: dailyObjective, affirmation: affirmation || null, mit_task_ids: mitTaskIds }
    const { data: updated, error } = await supabase
        .from('morning_ritual_logs')
        .update(fields)
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .select('id')

    if (error) return { error: error.message }
    if (!updated?.length) {
        // completed_at tiene DEFAULT now(): sin el null explícito, un borrador
        // quedaba guardado como si el día ya estuviera planificado.
        const { error: insError } = await supabase
            .from('morning_ritual_logs')
            .insert({ user_id: user.id, date: dateStr, ...fields, completed_at: null })
        if (insError) return { error: insError.message }
    }
    return { success: true }
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

// ============================================================
// PLANIFICAR EL DÍA
//
// El orden es el del uso real: todo se anota en el Inbox durante el día,
// a la mañana se vacía (cada captura va a tarea, evento, idea…), y recién
// con eso más las tareas abiertas, los objetivos y los hábitos se elige
// el foco: una línea y hasta 3 tareas.
// ============================================================

export async function getMorningData(dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    await syncRecurringTasks(user.id)

    const [tasksRes, habitsRes, inboxRes, eventsRes, objectivesRes, logsRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['Todo', 'InProgress'])
            .or(`due_date.lte.${dateStr},planned_date.eq.${dateStr},planned_date.is.null`)
            .order('priority', { ascending: true })
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(80),

        supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true),

        supabase
            .from('mental_notes')
            .select('id, content, created_at')
            .eq('user_id', user.id)
            .eq('is_processed', false)
            .order('created_at', { ascending: true }),

        supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('event_date', dateStr)
            .order('start_time', { ascending: true, nullsFirst: true }),

        supabase
            .from('objectives')
            .select('id, title, progress_pct, type, timeframe')
            .eq('user_id', user.id)
            .eq('status', 'Active')
            .order('priority', { ascending: true, nullsFirst: false }),

        supabase
            .from('habit_logs')
            .select('habit_id')
            .eq('user_id', user.id)
            .gte('completed_at', `${dateStr}T00:00:00-03:00`)
            .lt('completed_at', `${addDaysToDateStr(dateStr, 1)}T00:00:00-03:00`)
    ])

    const doneHabitIds = new Set((logsRes.data || []).map((l: any) => l.habit_id))
    const habits = (habitsRes.data || [])
        .filter((h: any) => isHabitScheduledForDate(h, dateStr))
        .map((h: any) => ({ ...h, done_today: doneHabitIds.has(h.id) }))

    const notes = inboxRes.data || []

    return {
        tasks: tasksRes.data || [],
        habits,
        inboxNotes: notes,
        inboxUnreadCount: notes.length,
        events: eventsRes.data || [],
        objectives: objectivesRes.data || []
    }
}

/** El plan de un día: la línea de foco y sus tareas, con su estado actual. */
export async function getDayPlan(dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { log: null, tasks: [] as any[] }

    const { data: log } = await supabase
        .from('morning_ritual_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle()

    const ids: string[] = log?.mit_task_ids || []
    if (!ids.length) return { log: log || null, tasks: [] as any[] }

    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, priority, objective_id')
        .eq('user_id', user.id)
        .in('id', ids)

    // Respeta el orden en que se eligieron: la primera es el foco #1.
    const byId = new Map((tasks || []).map(t => [t.id, t]))
    return { log, tasks: ids.map(id => byId.get(id)).filter(Boolean) as any[] }
}

/** Deja las tareas elegidas planificadas para ese día (aparecen en el dashboard). */
export async function planTasksForDay(taskIds: string[], dateStr: string) {
    if (!taskIds.length) return { success: true }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('tasks')
        .update({ planned_date: dateStr, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('id', taskIds)

    if (error) return { error: error.message }
    revalidatePath('/')
    revalidatePath('/tasks')
    revalidatePath('/planner')
    return { success: true }
}

/** Crea una tarea ya planificada para el día y la devuelve (para elegirla como foco). */
export async function createTaskForDay(title: string, dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }
    if (!title.trim()) return { error: 'Escribí la tarea.' }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: title.trim().slice(0, 200),
            priority: 2,
            category: 'Personal',
            energy_level: 'Deep Work',
            status: 'Todo',
            planned_date: dateStr
        })
        .select()
        .single()

    if (error) return { error: error.message }
    revalidatePath('/tasks')
    revalidatePath('/')
    return { success: true, task: data }
}

/**
 * Cierre del día: lo que quedó sin hacer del foco pasa a mañana, y opcionalmente
 * se deja escrita la línea de foco de mañana (el plan de la mañana arranca con ella).
 */
export async function carryOverToTomorrow(dateStr: string, tomorrowFocus?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const tomorrow = addDaysToDateStr(dateStr, 1)
    const { tasks } = await getDayPlan(dateStr)
    const pending = tasks.filter((t: any) => t.status !== 'Done').map((t: any) => t.id)

    if (pending.length) {
        const { error } = await supabase
            .from('tasks')
            .update({ planned_date: tomorrow, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .in('id', pending)
        if (error) return { error: error.message }
    }

    const { data: existing } = await supabase
        .from('morning_ritual_logs')
        .select('id, daily_objective, mit_task_ids, completed_at')
        .eq('user_id', user.id)
        .eq('date', tomorrow)
        .maybeSingle()

    // Si mañana ya está planificado no se pisa nada: solo se suman las pendientes.
    const mergedIds = Array.from(new Set([...(existing?.mit_task_ids || []), ...pending])).slice(0, 3)
    const focus = tomorrowFocus?.trim() || existing?.daily_objective || null

    const { error: upError } = await supabase
        .from('morning_ritual_logs')
        .upsert({
            user_id: user.id,
            date: tomorrow,
            daily_objective: focus,
            mit_task_ids: mergedIds,
            completed_at: existing?.completed_at ?? null
        }, { onConflict: 'user_id,date' })

    if (upError) return { error: upError.message }

    revalidatePath('/')
    revalidatePath('/ritual')
    revalidatePath('/cierre')
    return { success: true, moved: pending.length }
}

// ============================================================
// LA IA ORDENA, NO INVENTA
//
// Antes proponía un "objetivo del día" libre y salía cualquier cosa que no era
// lo que el usuario quería hacer. Ahora solo elige entre tareas que YA existen,
// empujando las que están atadas a un objetivo activo, y si el usuario ya
// escribió su foco, lo respeta.
// ============================================================

export interface MorningPlanSuggestion {
    daily_objective: string
    reasoning: string
    /** IDs de tareas ya existentes, en orden: la primera es el foco #1. */
    mit_task_ids: string[]
    mits: { task_id: string; title: string; reason: string }[]
    /** Lo que ve que se está yendo de control, si es que ve algo. */
    warning: string | null
}

export async function suggestMorningPlan(dateStr: string, userFocus?: string): Promise<ActionResult<MorningPlanSuggestion>> {
    return runAction('suggestMorningPlan', () => buildMorningPlan(dateStr, userFocus))
}

async function buildMorningPlan(dateStr: string, userFocus?: string): Promise<MorningPlanSuggestion> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const morningData = await getMorningData(dateStr)
    const tasks = (morningData?.tasks || []).slice(0, 40)
    if (!tasks.length) throw new Error('No tenés tareas abiertas para elegir. Cargá alguna o vaciá el Inbox primero.')

    const objectives = morningData?.objectives || []
    const objTitle = new Map(objectives.map((o: any) => [o.id, o.title]))

    const objectiveList = objectives.length
        ? objectives.map((o: any) => `- ${o.title} (${o.progress_pct || 0}%)`).join('\n')
        : '(no tiene objetivos activos)'

    const taskList = tasks
        .map((t: any, i: number) => {
            const bits = [`[${i}] ${t.title}`]
            if (t.priority) bits.push(`prioridad ${t.priority}`)
            if (t.due_date) bits.push(`vence ${String(t.due_date).slice(0, 10)}`)
            if (t.planned_date === dateStr) bits.push('ya planificada para hoy')
            if (t.objective_id && objTitle.has(t.objective_id)) bits.push(`objetivo: ${objTitle.get(t.objective_id)}`)
            return bits.join(' · ')
        })
        .join('\n')

    const habits = (morningData?.habits || []).map((h: any) => h.title).join(', ') || '(ninguno)'
    const events = (morningData?.events || [])
        .map((e: any) => `${e.is_all_day ? 'todo el día' : String(e.start_time || '').slice(0, 5)} ${e.title}`)
        .join(' · ') || '(sin eventos)'

    const prompt = `
Día: ${dateStr}

Objetivos activos del usuario:
${objectiveList}

Hábitos de hoy: ${habits}
Eventos de hoy: ${events}

Tareas abiertas, numeradas:
${taskList}

${userFocus?.trim()
        ? `El usuario YA decidió su foco de hoy: "${userFocus.trim()}". No lo cambies. Elegí las tareas que más sirven a ESE foco.`
        : 'El usuario todavía no escribió su foco.'}

Elegí entre 1 y 3 tareas para hoy.

Reglas duras:
- SOLO podés elegir tareas de la lista, por su número. Nunca inventes una tarea nueva.
- Orden de prioridad: lo que está vencido o ya planificado para hoy, después lo que empuja un objetivo activo, después el resto.
- Tené en cuenta los eventos: si el día está cargado, elegí menos.
- "daily_objective": si el usuario ya escribió su foco, devolvelo igual. Si no, una frase corta que resuma qué hace que hoy sea un buen día, basada en la tarea #1.
- "warning": solo si ves algo concreto saliéndose de control en estos datos (muchas vencidas, un objetivo sin ninguna tarea). Si no, null.
- Español rioplatense, directo, sin frases motivacionales.

Respondé SOLO con este JSON:
{
  "daily_objective": "...",
  "reasoning": "una frase citando datos concretos",
  "mits": [ { "index": 0, "reason": "..." } ],
  "warning": null
}`.trim()

    const text = await generateText(prompt, { temperature: 0.4, maxOutputTokens: 1200, json: true })
    const parsed = parseJSON<any>(text)

    const seen = new Set<string>()
    const mits = (Array.isArray(parsed.mits) ? parsed.mits : [])
        .map((m: any) => {
            const task = typeof m?.index === 'number' ? tasks[m.index] : null
            if (!task || seen.has(task.id)) return null
            seen.add(task.id)
            return { task_id: task.id as string, title: task.title as string, reason: m?.reason || '' }
        })
        .filter(Boolean)
        .slice(0, 3) as MorningPlanSuggestion['mits']

    if (!mits.length) throw new Error('La IA no eligió ninguna tarea válida. Probá de nuevo o elegí a mano.')

    return {
        daily_objective: userFocus?.trim() || String(parsed.daily_objective || mits[0].title).trim(),
        reasoning: parsed.reasoning || '',
        mit_task_ids: mits.map(m => m.task_id),
        mits,
        warning: parsed.warning && String(parsed.warning).toLowerCase() !== 'null' ? String(parsed.warning) : null
    }
}

// ============================================================
// BLOQUES DE TIEMPO
//
// Elegir qué hacer no alcanza: el bloque en la agenda es lo que lo vuelve
// real. Cada tarea del foco guarda a qué hora arranca y cuánto dura; la hora
// también queda como recordatorio en la PC.
// ============================================================

export async function setTaskBlocks(blocks: { id: string; start: string | null; minutes: number | null }[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    for (const b of blocks) {
        const start = b.start ? (b.start.length === 5 ? `${b.start}:00` : b.start) : null
        const { error } = await supabase
            .from('tasks')
            .update({
                block_start: start,
                estimated_minutes: b.minutes,
                reminder_time: start,
                reminder_fired: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', b.id)
            .eq('user_id', user.id)
        if (error) {
            if (String(error.message).includes('block_start') || String(error.message).includes('estimated_minutes')) {
                return { error: 'Para guardar los horarios falta correr la migración 028 en Supabase.' }
            }
            return { error: error.message }
        }
    }

    revalidatePath('/')
    revalidatePath('/tasks')
    return { success: true }
}
