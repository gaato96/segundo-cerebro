'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { runAction, type ActionResult } from '@/lib/actionResult'

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

    const { data, error } = await supabase
        .from('morning_ritual_logs')
        .upsert({
            user_id: user.id,
            date: dateStr,
            daily_objective: dailyObjective,
            affirmation: affirmation || null,
            mit_task_ids: mitTaskIds
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

import { syncRecurringTasks } from '@/lib/actions/tasks'

export async function getMorningData(dateStr: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    await syncRecurringTasks(user.id)

    const [tasksRes, habitsRes, inboxRes, eventsRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['Todo', 'InProgress'])
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

// ============================================================
// EL COACH ARRANCA EL DÍA POR VOS
//
// La primera tarjeta del ritual es la más cara: a las 7 de la mañana no sabés
// por dónde empezar y la decisión sigue abierta. Esto la cierra mirando TODO
// el Segundo Cerebro (tareas vencidas, hábitos caídos, plata, objetivos,
// entrenamiento) y proponiendo objetivo, MITs y afirmación.
// ============================================================

export interface MorningPlanSuggestion {
    daily_objective: string
    reasoning: string
    affirmation: string
    /** IDs de tareas ya existentes que el coach eligió como MITs. */
    mit_task_ids: string[]
    mits: { task_id: string | null; title: string; reason: string }[]
    /** Lo que ve que se está yendo de control, si es que ve algo. */
    warning: string | null
}

export async function suggestMorningPlan(dateStr: string): Promise<ActionResult<MorningPlanSuggestion>> {
    return runAction('suggestMorningPlan', () => buildMorningPlan(dateStr))
}

async function buildMorningPlan(dateStr: string): Promise<MorningPlanSuggestion> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const [snapshot, morningData] = await Promise.all([
        buildBrainSnapshot(),
        getMorningData(dateStr)
    ])

    const tasks = (morningData?.tasks || []).slice(0, 30)

    const taskList = tasks.length
        ? tasks
            .map((t: any, i: number) => {
                const bits = [`[${i}] ${t.title}`]
                if (t.priority) bits.push(`prioridad ${t.priority}`)
                if (t.due_date) bits.push(`vence ${t.due_date}`)
                if (t.category) bits.push(t.category)
                return bits.join(' · ')
            })
            .join('\n')
        : '(no tiene tareas abiertas cargadas)'

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Tareas abiertas del usuario, numeradas:
${taskList}

Sos su coach y le estás armando el arranque del día ${dateStr}. Todavía no decidió nada: decidí vos mirando sus datos reales.

Reglas duras:
- El objetivo del día es UNO solo, concreto y terminable hoy. Nada de "avanzar en X".
- Elegí entre 1 y 3 MITs. Priorizá lo vencido y lo que destraba otra cosa, no lo urgente-ruidoso.
- Preferí tareas que YA existen (usá su número). Solo proponé una nueva si no hay ninguna que sirva, y en ese caso poné index null.
- Si ves algo saliéndose de control (plata, tareas vencidas hace días, un hábito que se cayó, ánimo bajo sostenido), decilo en "warning". Si no ves nada, poné null.
- La afirmación se escribe en primera persona y tiene que enganchar con lo que hoy le cuesta, no ser una frase de taza.
- Español rioplatense con voseo. Directo, sin palmaditas.

Respondé SOLO con este JSON:
{
  "daily_objective": "...",
  "reasoning": "una o dos frases citando datos concretos suyos",
  "mits": [ { "index": 0, "title": "...", "reason": "..." } ],
  "affirmation": "...",
  "warning": "... o null"
}`.trim()

    const text = await generateText(prompt, { temperature: 0.6, maxOutputTokens: 1800, json: true })
    const parsed = parseJSON<any>(text)

    if (!parsed.daily_objective) {
        throw new Error('La IA no devolvió ningún objetivo. Probá de nuevo en unos segundos.')
    }

    const mits = (Array.isArray(parsed.mits) ? parsed.mits : [])
        .slice(0, 3)
        .map((m: any) => {
            const task = typeof m?.index === 'number' ? tasks[m.index] : null
            return {
                task_id: task?.id || null,
                title: task?.title || m?.title || '',
                reason: m?.reason || ''
            }
        })
        .filter((m: any) => m.title)

    return {
        daily_objective: String(parsed.daily_objective).trim(),
        reasoning: parsed.reasoning || '',
        affirmation: parsed.affirmation || '',
        mit_task_ids: mits.map((m: any) => m.task_id).filter(Boolean) as string[],
        mits,
        warning: parsed.warning && String(parsed.warning).toLowerCase() !== 'null' ? String(parsed.warning) : null
    }
}
