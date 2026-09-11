'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { getLocalDateStr, getLocalDayOfWeek, addDaysToDateStr } from '@/lib/utils'
import { poolFor, equipmentLabel, type EquipmentId, type Level } from '@/lib/trainingLibrary'
import {
    buildTwelveWeeks,
    blockParamsFor,
    prescriptionFor,
    DEFAULT_DAYS,
    type TrainingProfileInput,
    type PlanItem,
    type PlanWeek
} from '@/lib/trainingGenerator'

// ============================================================
// CAPA IA: notas de coach por semana (opcional, con fallback)
// ============================================================

async function enrichWithCoachNotes(weeks: PlanWeek[], profile: TrainingProfileInput): Promise<PlanWeek[]> {
    const outline = weeks.map(w =>
        `Semana ${w.week} (${w.block}${w.deload ? ', DESCARGA' : ''}): ${w.days.map(d => d.title).join(' / ')}. Soga: ${w.rope?.prescription || 'sin soga'}.`
    ).join('\n')

    const prompt = `
Sos preparador físico en Tucumán, Argentina. Este es el esqueleto de un plan de 12 semanas ya armado:

${outline}

Perfil: nivel ${profile.level}, objetivo ${profile.goal}, ${profile.days_per_week} días por semana, sesiones de ${profile.session_minutes} min, entrena en ${profile.location}.
Equipamiento: ${profile.equipment.map(equipmentLabel).join(', ')}${profile.include_rope ? ' + soga de saltar' : ''}.
Limitaciones o lesiones: ${profile.limitations || 'ninguna declarada'}.
Notas del usuario: ${profile.notes || 'ninguna'}.

Escribí una nota de coach para cada semana: máximo 2 frases, en español rioplatense con voseo, concreta y accionable (qué mirar esa semana, qué error evitar, cómo saber si vas bien). Si hay limitaciones declaradas, mencioná adaptaciones en las semanas que corresponda.

Respondé SOLO con este JSON:
{ "summary": "3 frases sobre la lógica del plan completo", "notes": { "1": "...", "2": "...", "3": "...", "4": "...", "5": "...", "6": "...", "7": "...", "8": "...", "9": "...", "10": "...", "11": "...", "12": "..." } }`.trim()

    try {
        const text = await generateText(prompt, { temperature: 0.6, maxOutputTokens: 1800, json: true })
        const parsed = parseJSON<{ summary?: string; notes?: Record<string, string> }>(text)
        const notes = parsed.notes || {}
        return weeks.map(w => ({
            ...w,
            coach_note: notes[String(w.week)] ? `${notes[String(w.week)]} · ${w.coach_note}` : w.coach_note,
            ai_summary: parsed.summary
        })) as PlanWeek[]
    } catch (e) {
        console.warn('[training] No se pudieron generar las notas de coach, sigo con el plan base:', e)
        return weeks
    }
}

// ============================================================
// ACCIONES DE PERFIL
// ============================================================

export async function getTrainingProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('training_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function saveTrainingProfile(form: TrainingProfileInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const equipment = [...new Set(['peso_corporal', ...(form.include_rope ? ['soga'] : []), ...form.equipment])]

    const { data, error } = await supabase
        .from('training_profiles')
        .upsert({
            user_id: user.id,
            level: form.level,
            goal: form.goal,
            days_per_week: form.days_per_week,
            session_minutes: form.session_minutes,
            equipment,
            location: form.location,
            include_rope: form.include_rope,
            preferred_days: form.preferred_days?.length ? form.preferred_days : DEFAULT_DAYS[form.days_per_week] || DEFAULT_DAYS[4],
            limitations: form.limitations || '',
            notes: form.notes || ''
        }, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/meals/nutrition')
    return data
}

// ============================================================
// ACCIONES DE PLAN
// ============================================================

export async function getActiveTrainingPlan() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) throw error
    return data
}

/** Semana del plan en la que estás hoy (1-12). */
export async function getCurrentWeekNumber(plan: { start_date: string } | null): Promise<number> {
    if (!plan) return 1
    const today = getLocalDateStr()
    const diffDays = Math.floor(
        (new Date(`${today}T12:00:00`).getTime() - new Date(`${plan.start_date}T12:00:00`).getTime()) / 86400000
    )
    return Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), 12)
}

export async function generateTrainingPlan(options?: { startDate?: string; useAI?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const profileRow = await getTrainingProfile()
    if (!profileRow) throw new Error('Completá primero tu perfil de entrenamiento (equipamiento, días y nivel).')

    const profile: TrainingProfileInput = {
        level: profileRow.level,
        goal: profileRow.goal,
        days_per_week: profileRow.days_per_week,
        session_minutes: profileRow.session_minutes,
        equipment: profileRow.equipment || ['peso_corporal'],
        location: profileRow.location,
        include_rope: profileRow.include_rope,
        preferred_days: profileRow.preferred_days || [],
        limitations: profileRow.limitations,
        notes: profileRow.notes
    }

    // Arranca el lunes siguiente (o hoy si hoy es lunes)
    let startDate = options?.startDate
    if (!startDate) {
        const today = getLocalDateStr()
        const dow = getLocalDayOfWeek()
        const isoDay = dow === 0 ? 7 : dow
        startDate = isoDay === 1 ? today : addDaysToDateStr(today, 8 - isoDay)
    }
    const endDate = addDaysToDateStr(startDate, 83) // 12 semanas

    let weeks = buildTwelveWeeks(profile)
    if (options?.useAI !== false) {
        weeks = await enrichWithCoachNotes(weeks, profile)
    }

    // Archivar planes anteriores
    await supabase
        .from('training_plans')
        .update({ status: 'archived' })
        .eq('user_id', user.id)
        .eq('status', 'active')

    const totalSessions = weeks.reduce((s, w) => s + w.days.length, 0)
    const totalRope = weeks.reduce((s, w) => s + (w.rope?.total_minutes || 0) * w.days.filter(d => d.blocks.some(b => b.type === 'soga')).length, 0)

    const { data, error } = await supabase
        .from('training_plans')
        .insert({
            user_id: user.id,
            name: `Plan 3 meses · ${profile.goal.replace('_', ' ')} · ${profile.level}`,
            start_date: startDate,
            end_date: endDate,
            goal: profile.goal,
            level: profile.level,
            days_per_week: profile.days_per_week,
            session_minutes: profile.session_minutes,
            equipment: profile.equipment,
            status: 'active',
            plan_data: {
                weeks,
                summary: (weeks[0] as any)?.ai_summary || null,
                stats: {
                    total_sessions: totalSessions,
                    total_rope_minutes: Math.round(totalRope),
                    unique_exercises: new Set(
                        weeks.flatMap(w => w.days.flatMap(d => d.blocks.flatMap(b => b.items.map(i => i.name))))
                    ).size
                }
            }
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/meals/nutrition')
    revalidatePath('/entrenamiento')
    return data
}

/** Vuelve a sortear los ejercicios de UNA semana sin tocar el resto del plan. */
export async function regenerateWeek(planId: string, weekNumber: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: plan } = await supabase
        .from('training_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user.id)
        .single()

    if (!plan) throw new Error('Plan no encontrado')

    const profileRow = await getTrainingProfile()
    if (!profileRow) throw new Error('Falta el perfil de entrenamiento')

    const profile: TrainingProfileInput = {
        level: profileRow.level,
        goal: profileRow.goal,
        days_per_week: profileRow.days_per_week,
        session_minutes: profileRow.session_minutes,
        equipment: profileRow.equipment || ['peso_corporal'],
        location: profileRow.location,
        include_rope: profileRow.include_rope,
        preferred_days: profileRow.preferred_days || [],
        limitations: profileRow.limitations,
        notes: profileRow.notes
    }

    // Un offset distinto cada vez → ejercicios distintos a los que ya tenía
    const offset = Math.floor(Math.random() * 5) + 1
    const fresh = buildTwelveWeeks(profile, offset)
    const replacement = fresh.find(w => w.week === weekNumber)
    if (!replacement) throw new Error('Semana inválida')

    const planData = { ...plan.plan_data }
    planData.weeks = (planData.weeks || []).map((w: PlanWeek) =>
        w.week === weekNumber ? { ...replacement, coach_note: w.coach_note } : w
    )

    const { error } = await supabase
        .from('training_plans')
        .update({ plan_data: planData })
        .eq('id', planId)

    if (error) throw error
    revalidatePath('/entrenamiento')
    return replacement
}

/** Cambia un ejercicio puntual por otro del mismo patrón. */
export async function swapExercise(planId: string, weekNumber: number, dayIndex: number, blockIndex: number, itemIndex: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const [{ data: plan }, profileRow] = await Promise.all([
        supabase.from('training_plans').select('*').eq('id', planId).eq('user_id', user.id).single(),
        getTrainingProfile()
    ])
    if (!plan || !profileRow) throw new Error('Plan o perfil no encontrado')

    const planData = { ...plan.plan_data }
    const week = (planData.weeks || []).find((w: PlanWeek) => w.week === weekNumber)
    const day = week?.days?.[dayIndex]
    const block = day?.blocks?.[blockIndex]
    const item = block?.items?.[itemIndex]
    if (!item) throw new Error('Ejercicio no encontrado')

    const equipment: EquipmentId[] = profileRow.equipment || ['peso_corporal']
    const pool = poolFor(item.pattern, equipment, profileRow.level)
    const currentNames = new Set(block.items.map((i: PlanItem) => i.name))
    const alternatives = pool.filter(ex => !currentNames.has(ex.name))
    if (!alternatives.length) throw new Error('No hay otra variante disponible con tu equipamiento actual.')

    const next = alternatives[Math.floor(Math.random() * alternatives.length)]
    const params = blockParamsFor(weekNumber, profileRow.level)
    block.items[itemIndex] = prescriptionFor(next, params)

    const { error } = await supabase
        .from('training_plans')
        .update({ plan_data: planData })
        .eq('id', planId)

    if (error) throw error
    revalidatePath('/entrenamiento')
    return block.items[itemIndex]
}

export async function archiveTrainingPlan(planId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('training_plans')
        .update({ status: 'archived' })
        .eq('id', planId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/entrenamiento')
}

// ============================================================
// REGISTRO DE SESIONES
// ============================================================

export async function logTrainingSession(input: {
    planId: string
    weekNumber: number
    dayIndex: number
    durationMin?: number
    rpe?: number
    ropeMinutes?: number
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('training_logs')
        .upsert({
            user_id: user.id,
            plan_id: input.planId,
            week_number: input.weekNumber,
            day_index: input.dayIndex,
            date: getLocalDateStr(),
            completed: true,
            duration_min: input.durationMin || null,
            rpe: input.rpe || null,
            rope_minutes: input.ropeMinutes || null,
            notes: input.notes || null
        }, { onConflict: 'user_id, plan_id, week_number, day_index' })

    if (error) throw error
    revalidatePath('/entrenamiento')
    revalidatePath('/')
}

export async function undoTrainingSession(planId: string, weekNumber: number, dayIndex: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('training_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('week_number', weekNumber)
        .eq('day_index', dayIndex)

    if (error) throw error
    revalidatePath('/entrenamiento')
}

export async function getTrainingLogs(planId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let query = supabase
        .from('training_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

    if (planId) query = query.eq('plan_id', planId)

    const { data, error } = await query
    if (error) throw error
    return data || []
}
