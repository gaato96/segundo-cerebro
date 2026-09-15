'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { getLocalDateStr } from '@/lib/utils'

export interface KeyResult {
    title: string
    metric: string
    target: number
    current: number
    unit: string
}

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
    key_results?: KeyResult[]
    smart_notes?: string | null
    ai_generated?: boolean
    target_date?: string | null
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

// ============================================================
// OBJETIVOS SMART PROPUESTOS POR IA
//
// Un objetivo sin métrica ni fecha no es un objetivo: es un deseo. Y un
// objetivo que no baja a tareas y hábitos no se cumple solo. Esto hace las
// tres cosas de una: propone el objetivo, le pone números, y lo aterriza.
// ============================================================

export interface SuggestedTask {
    title: string
    priority: 1 | 2 | 3
    /** En qué semana del plan conviene hacerla. */
    week: number
}

export interface SuggestedHabit {
    title: string
    frequency_type: 'daily' | 'x_per_week'
    frequency_times_per_week: number
    estimated_minutes: number
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
}

export interface ObjectiveSuggestion {
    title: string
    description: string
    timeframe: 'Year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
    type: 'Personal' | 'Professional'
    target_date: string | null
    key_results: KeyResult[]
    /** Por qué este objetivo pasa el filtro SMART, campo por campo. */
    smart_notes: string
    why: string
    /** Lo honesto: qué podría hacer que este objetivo no se cumpla. */
    risk: string
    tasks: SuggestedTask[]
    habits: SuggestedHabit[]
}

export async function suggestObjectives(focus?: string): Promise<ActionResult<ObjectiveSuggestion[]>> {
    return runAction('suggestObjectives', () => buildObjectiveSuggestions(focus))
}

const TIMEFRAMES = ['Year', 'Q1', 'Q2', 'Q3', 'Q4']
const TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function buildObjectiveSuggestions(focus?: string): Promise<ObjectiveSuggestion[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const [snapshot, existingRes] = await Promise.all([
        buildBrainSnapshot(),
        supabase.from('objectives').select('title, status, progress_pct').eq('user_id', user.id)
    ])

    const existing = (existingRes.data || [])
        .map((o: any) => `- ${o.title} (${o.status}, ${o.progress_pct ?? 0}%)`)
        .join('\n') || '(no tiene objetivos cargados)'

    const today = getLocalDateStr()

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Objetivos que YA tiene cargados:
${existing}

Hoy es ${today}.${focus ? ` El usuario quiere enfocarse en: ${focus}.` : ''}

Sos su estratega. Proponé 3 objetivos NUEVOS con método SMART, que pueda cumplir de verdad.

Reglas duras:
- Nada que ya tenga cargado, ni una versión disfrazada de lo mismo.
- REALISTA por encima de todo. Mirá su plata real, su tiempo real y su nivel de cumplimiento real (fijate en su adherencia a compromisos y hábitos). Un objetivo que no va a cumplir es peor que no tener objetivo: le confirma que no puede.
- Cada objetivo necesita entre 2 y 3 resultados clave con NÚMERO y unidad. Nada de "mejorar" o "avanzar": qué número, desde cuánto, hasta cuánto.
- "target_date" tiene que ser una fecha real YYYY-MM-DD posterior a hoy y alcanzable.
- Las tareas son concretas y de una sola sesión. Entre 3 y 5 por objetivo, con la semana en la que conviene hacerlas.
- Los hábitos son el motor: entre 1 y 2 por objetivo, de menos de 20 minutos. Preferí "x_per_week" antes que diario.
- "risk" es lo que más probablemente haga que esto falle, según sus propios datos. Sé honesto, no optimista.
- Español rioplatense con voseo. Directo.

Respondé SOLO con este JSON:
{
  "objectives": [
    {
      "title": "...",
      "description": "...",
      "timeframe": "Q1",
      "type": "Professional",
      "target_date": "2026-12-31",
      "key_results": [ { "title": "...", "metric": "...", "target": 10, "current": 0, "unit": "clientes" } ],
      "smart_notes": "Específico: ... Medible: ... Alcanzable: ... Relevante: ... Temporal: ...",
      "why": "por qué este objetivo y no otro, citando algo real suyo",
      "risk": "lo que más probablemente lo haga fallar",
      "tasks": [ { "title": "...", "priority": 1, "week": 1 } ],
      "habits": [ { "title": "...", "frequency_type": "x_per_week", "frequency_times_per_week": 3, "estimated_minutes": 15, "time_of_day": "morning" } ]
    }
  ]
}`.trim()

    const text = await generateText(prompt, { temperature: 0.6, maxOutputTokens: 3500, json: true })
    const parsed = parseJSON<{ objectives?: any[] }>(text)

    const suggestions: ObjectiveSuggestion[] = (parsed.objectives || []).slice(0, 3).map((o: any) => ({
        title: String(o.title || '').slice(0, 200),
        description: o.description || '',
        timeframe: TIMEFRAMES.includes(o.timeframe) ? o.timeframe : 'Q1',
        type: (o.type === 'Professional' ? 'Professional' : 'Personal') as 'Personal' | 'Professional',
        target_date: DATE_RE.test(o.target_date || '') ? o.target_date : null,
        key_results: (Array.isArray(o.key_results) ? o.key_results : []).slice(0, 4).map((kr: any) => ({
            title: String(kr.title || '').slice(0, 160),
            metric: String(kr.metric || ''),
            target: Number(kr.target) || 0,
            current: Number(kr.current) || 0,
            unit: String(kr.unit || '')
        })).filter((kr: KeyResult) => kr.title),
        smart_notes: o.smart_notes || '',
        why: o.why || '',
        risk: o.risk || '',
        tasks: (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 6).map((t: any) => ({
            title: String(t.title || '').slice(0, 200),
            priority: [1, 2, 3].includes(t.priority) ? t.priority : 2,
            week: Math.max(Number(t.week) || 1, 1)
        })).filter((t: SuggestedTask) => t.title),
        habits: (Array.isArray(o.habits) ? o.habits : []).slice(0, 3).map((h: any) => ({
            title: String(h.title || '').slice(0, 120),
            frequency_type: h.frequency_type === 'daily' ? 'daily' as const : 'x_per_week' as const,
            frequency_times_per_week: Math.min(Math.max(Number(h.frequency_times_per_week) || 3, 1), 7),
            estimated_minutes: Math.min(Math.max(Number(h.estimated_minutes) || 15, 1), 60),
            time_of_day: TIME_OF_DAY.includes(h.time_of_day) ? h.time_of_day : 'anytime'
        })).filter((h: SuggestedHabit) => h.title)
    })).filter((o: ObjectiveSuggestion) => o.title)

    if (!suggestions.length) throw new Error('La IA no devolvió ningún objetivo. Probá de nuevo.')
    return suggestions
}

/**
 * Baja el objetivo a tierra: lo crea con sus resultados clave y genera las
 * tareas y hábitos que lo hacen posible, todos enganchados al objetivo.
 */
export async function createObjectiveFromSuggestion(
    suggestion: ObjectiveSuggestion,
    options: { withTasks?: boolean; withHabits?: boolean } = {}
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { withTasks = true, withHabits = true } = options

    const { data: objective, error } = await supabase
        .from('objectives')
        .insert({
            user_id: user.id,
            title: suggestion.title,
            description: suggestion.description || null,
            timeframe: suggestion.timeframe,
            type: suggestion.type,
            status: 'Active',
            progress_pct: 0,
            target_date: suggestion.target_date,
            key_results: suggestion.key_results,
            smart_notes: suggestion.smart_notes || null,
            ai_generated: true
        })
        .select()
        .single()

    if (error) return { error: error.message }

    let tasksCreated = 0
    let habitsCreated = 0

    if (withTasks && suggestion.tasks.length) {
        const today = getLocalDateStr()
        const rows = suggestion.tasks.map(t => ({
            user_id: user.id,
            title: t.title,
            status: 'Todo',
            priority: t.priority,
            category: suggestion.type === 'Professional' ? 'Work' : 'Personal',
            objective_id: objective.id,
            // La semana del plan se traduce a una fecha real: un plan sin fechas
            // es una lista de buenas intenciones.
            due_date: addWeeks(today, t.week)
        }))
        const { data: inserted, error: taskError } = await supabase.from('tasks').insert(rows).select('id')
        if (!taskError) tasksCreated = inserted?.length ?? 0
    }

    if (withHabits && suggestion.habits.length) {
        const rows = suggestion.habits.map(h => ({
            user_id: user.id,
            title: h.title,
            frequency: 'daily',
            goal_count: 1,
            color_hex: '#8b5cf6',
            estimated_minutes: h.estimated_minutes,
            time_of_day: h.time_of_day,
            icon: 'target',
            is_active: true,
            objective_id: objective.id,
            frequency_type: h.frequency_type,
            frequency_days: [],
            frequency_times_per_day: 1,
            frequency_times_per_week: h.frequency_times_per_week
        }))
        const { data: inserted, error: habitError } = await supabase.from('habits').insert(rows).select('id')
        if (!habitError) habitsCreated = inserted?.length ?? 0
    }

    revalidatePath('/okrs')
    revalidatePath('/tasks')
    revalidatePath('/habits')
    revalidatePath('/')
    return { success: true, objectiveId: objective.id, tasksCreated, habitsCreated }
}

function addWeeks(dateStr: string, weeks: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d + weeks * 7)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Actualiza el valor actual de los resultados clave y recalcula el progreso. */
export async function updateKeyResults(objectiveId: string, keyResults: KeyResult[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    // El progreso del objetivo es el promedio del avance de sus resultados clave.
    const ratios = keyResults
        .filter(kr => kr.target > 0)
        .map(kr => Math.min(kr.current / kr.target, 1))

    const progress = ratios.length
        ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100)
        : 0

    const { error } = await supabase
        .from('objectives')
        .update({
            key_results: keyResults,
            progress_pct: progress,
            ...(progress >= 100 ? { status: 'Completed' } : {})
        })
        .eq('id', objectiveId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/okrs')
    return { success: true, progress }
}
