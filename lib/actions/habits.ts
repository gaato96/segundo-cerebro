'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { runAction, type ActionResult } from '@/lib/actionResult'

export interface HabitItem {
    id: string
    user_id: string
    title: string
    frequency: 'daily' | 'weekly'
    frequency_type: 'daily' | 'custom_days' | 'x_per_week' | 'x_per_day'
    frequency_days: number[]      // ISO day of week: 1=Mon…7=Sun
    frequency_times_per_day: number
    /** Cupo semanal cuando frequency_type es 'x_per_week'. */
    frequency_times_per_week: number
    goal_count: number
    color_hex: string
    objective_id?: string | null
    estimated_minutes: number
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
    order_index: number
    icon: string
    is_active: boolean
    created_at?: string
}

export interface HabitLogItem {
    id: string
    habit_id: string
    user_id: string
    completed_at: string
    note?: string | null
}

export async function getHabitsWithStats(monthYear?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { habits: [], logs: [], monthlyStats: { completionRate: 0, activeHabitsCount: 0, totalLogsMonth: 0 } }

    const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('time_of_day', { ascending: true })
        .order('estimated_minutes', { ascending: true })

    if (habitsError) {
        console.error('Error fetching habits:', habitsError)
    }

    const { data: logs, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)

    if (logsError) {
        console.error('Error fetching habit logs:', logsError)
    }

    const habitsList = habits || []
    const logsList = logs || []

    const now = new Date()
    const currentMonthPrefix = monthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const monthLogs = logsList.filter(l => l.completed_at.startsWith(currentMonthPrefix))

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const possibleCompletions = (habitsList.length || 1) * daysInMonth
    const completionRate = Math.min(100, Math.round((monthLogs.length / possibleCompletions) * 100))

    return {
        habits: habitsList as HabitItem[],
        logs: logsList as HabitLogItem[],
        monthlyStats: {
            completionRate,
            activeHabitsCount: habitsList.filter(h => h.is_active).length,
            totalLogsMonth: monthLogs.length
        }
    }
}

export async function createHabit(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const estimated_minutes = parseInt(formData.get('estimated_minutes') as string) || 15
    const time_of_day = (formData.get('time_of_day') as any) || 'morning'
    const icon = (formData.get('icon') as string) || 'flame'
    const frequency_type = (formData.get('frequency_type') as string) || 'daily'
    const frequency_days_raw = formData.get('frequency_days') as string
    const frequency_days = frequency_days_raw
        ? frequency_days_raw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7)
        : []
    const frequency_times_per_day = parseInt(formData.get('frequency_times_per_day') as string) || 1
    const frequency_times_per_week = parseInt(formData.get('frequency_times_per_week') as string) || 3

    if (!title) return { error: 'El título es requerido' }

    const { error } = await supabase
        .from('habits')
        .insert({
            user_id: user.id,
            title,
            frequency: 'daily',
            goal_count: 1,
            color_hex,
            estimated_minutes,
            time_of_day,
            icon,
            is_active: true,
            frequency_type,
            frequency_days,
            frequency_times_per_day,
            frequency_times_per_week
        })

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

export async function updateHabit(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const estimated_minutes = parseInt(formData.get('estimated_minutes') as string) || 15
    const time_of_day = (formData.get('time_of_day') as any) || 'morning'
    const icon = (formData.get('icon') as string) || 'flame'
    const frequency_type = (formData.get('frequency_type') as string) || 'daily'
    const frequency_days_raw = formData.get('frequency_days') as string
    const frequency_days = frequency_days_raw
        ? frequency_days_raw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7)
        : []
    const frequency_times_per_day = parseInt(formData.get('frequency_times_per_day') as string) || 1
    const frequency_times_per_week = parseInt(formData.get('frequency_times_per_week') as string) || 3

    const { error } = await supabase
        .from('habits')
        .update({
            title,
            color_hex,
            estimated_minutes,
            time_of_day,
            icon,
            frequency_type,
            frequency_days,
            frequency_times_per_day,
            frequency_times_per_week
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

export async function deleteHabit(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

// ============================================================
// LA IA PROPONE HÁBITOS NUEVOS
//
// Un hábito que no encaja con la vida real no se sostiene. Estas propuestas
// salen de mirar lo que ya tiene: objetivos abiertos, hábitos que se le caen,
// horarios libres, entrenamiento, plata y ánimo.
// ============================================================

export interface HabitSuggestion {
    title: string
    why: string
    frequency_type: 'daily' | 'custom_days' | 'x_per_week' | 'x_per_day'
    frequency_days: number[]
    frequency_times_per_week: number
    frequency_times_per_day: number
    estimated_minutes: number
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
    color_hex: string
    /** El mínimo ridículo: la versión que no podés fallar ni en el peor día. */
    minimum_version: string
    /** A qué hábito o rutina existente lo engancha (habit stacking). */
    anchor: string | null
}

export async function suggestHabits(): Promise<ActionResult<HabitSuggestion[]>> {
    return runAction('suggestHabits', buildHabitSuggestions)
}

const VALID_FREQ = ['daily', 'custom_days', 'x_per_week', 'x_per_day']
const VALID_TOD = ['morning', 'afternoon', 'evening', 'anytime']

async function buildHabitSuggestions(): Promise<HabitSuggestion[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const snapshot = await buildBrainSnapshot()

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Sos su coach de hábitos. Proponé 3 hábitos NUEVOS que le convengan de verdad según sus datos.

Reglas duras:
- Nada que ya tenga cargado. Si un hábito suyo viene fallando, no lo repitas: proponé algo distinto que lo destrabe.
- Cada hábito tiene que servir a un objetivo, un problema o un patrón concreto que se vea en sus datos. Si no podés justificarlo con algo real suyo, no lo propongas.
- Máximo 20 minutos cada uno. Si algo necesita más, no es un hábito: es un proyecto.
- Preferí "x_per_week" (3 o 4 veces por semana) antes que diario, salvo que sea algo muy chico. Un hábito diario que se rompe el día 3 hace más daño que uno de 3 veces por semana que se sostiene.
- "minimum_version" es la versión de 2 minutos: tiene que ser imposible de fallar incluso en el peor día.
- "anchor" es a qué cosa que YA hace lo enganchás (ej: "después del café de la mañana"). Si no tenés dónde, null.
- frequency_days usa ISO: 1 = lunes … 7 = domingo. Solo si frequency_type es "custom_days".
- Español rioplatense con voseo. Directo, sin motivación de póster.

Respondé SOLO con este JSON:
{
  "habits": [
    {
      "title": "...",
      "why": "por qué este y no otro, citando algo real suyo",
      "frequency_type": "x_per_week",
      "frequency_days": [],
      "frequency_times_per_week": 3,
      "frequency_times_per_day": 1,
      "estimated_minutes": 15,
      "time_of_day": "morning",
      "color_hex": "#10b981",
      "minimum_version": "...",
      "anchor": "..."
    }
  ]
}`.trim()

    const text = await generateText(prompt, { temperature: 0.7, maxOutputTokens: 2000, json: true })
    const parsed = parseJSON<{ habits?: any[] }>(text)

    const suggestions = (parsed.habits || []).slice(0, 4).map((h: any) => ({
        title: String(h.title || '').slice(0, 120),
        why: h.why || '',
        frequency_type: VALID_FREQ.includes(h.frequency_type) ? h.frequency_type : 'x_per_week',
        frequency_days: Array.isArray(h.frequency_days)
            ? h.frequency_days.map(Number).filter((n: number) => n >= 1 && n <= 7)
            : [],
        frequency_times_per_week: Math.min(Math.max(Number(h.frequency_times_per_week) || 3, 1), 7),
        frequency_times_per_day: Math.min(Math.max(Number(h.frequency_times_per_day) || 1, 1), 10),
        estimated_minutes: Math.min(Math.max(Number(h.estimated_minutes) || 15, 1), 120),
        time_of_day: VALID_TOD.includes(h.time_of_day) ? h.time_of_day : 'anytime',
        color_hex: /^#[0-9a-f]{6}$/i.test(h.color_hex || '') ? h.color_hex : '#6366f1',
        minimum_version: h.minimum_version || '',
        anchor: h.anchor && String(h.anchor).toLowerCase() !== 'null' ? String(h.anchor) : null
    })).filter((h: HabitSuggestion) => h.title)

    if (!suggestions.length) throw new Error('La IA no devolvió ningún hábito. Probá de nuevo.')
    return suggestions
}

/** Crea de una un hábito propuesto por la IA, sin pasar por el formulario. */
export async function createHabitFromSuggestion(suggestion: HabitSuggestion) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('habits')
        .insert({
            user_id: user.id,
            title: suggestion.title,
            frequency: 'daily',
            goal_count: 1,
            color_hex: suggestion.color_hex,
            estimated_minutes: suggestion.estimated_minutes,
            time_of_day: suggestion.time_of_day,
            icon: 'flame',
            is_active: true,
            frequency_type: suggestion.frequency_type,
            frequency_days: suggestion.frequency_days,
            frequency_times_per_day: suggestion.frequency_times_per_day,
            frequency_times_per_week: suggestion.frequency_times_per_week
        })

    if (error) return { error: error.message }

    revalidatePath('/habits')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}
