'use server'

import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/ai'
import { buildSystemPrompt } from '@/lib/assistantPersonas'
import { getAssistantContextProfile } from '@/lib/actions/assistant'
import { getLocalDateStr, addDaysToDateStr } from '@/lib/utils'

/**
 * Correlaciones.
 *
 * Con journal (ánimo), hábitos, entrenamiento, compromisos y finanzas en la misma
 * base, se puede responder algo que ninguna app suelta puede: "¿cómo viene tu ánimo
 * las semanas que entrenás contra las que no?".
 *
 * Importante: son correlaciones, no causas. Y con pocos datos no dicen nada, así que
 * cada resultado lleva su tamaño de muestra y se marca como poco confiable si es chico.
 */

export interface Correlation {
    id: string
    question: string
    /** Promedio del grupo "con" el comportamiento. */
    withValue: number | null
    withLabel: string
    withSample: number
    /** Promedio del grupo "sin". */
    withoutValue: number | null
    withoutLabel: string
    withoutSample: number
    unit: string
    /** Diferencia relativa, positiva = mejor con el comportamiento. */
    delta: number | null
    reliable: boolean
    reading: string
}

const MIN_SAMPLE = 4

function avg(values: number[]): number | null {
    if (!values.length) return null
    return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2))
}

function buildCorrelation(params: {
    id: string
    question: string
    withValues: number[]
    withLabel: string
    withoutValues: number[]
    withoutLabel: string
    unit: string
    higherIsBetter?: boolean
}): Correlation {
    const withValue = avg(params.withValues)
    const withoutValue = avg(params.withoutValues)
    const reliable = params.withValues.length >= MIN_SAMPLE && params.withoutValues.length >= MIN_SAMPLE

    let delta: number | null = null
    if (withValue !== null && withoutValue !== null && withoutValue !== 0) {
        delta = Number((((withValue - withoutValue) / Math.abs(withoutValue)) * 100).toFixed(0))
    }

    let reading: string
    if (!reliable) {
        reading = `Todavía no hay datos suficientes (${params.withValues.length} y ${params.withoutValues.length} días). Necesita al menos ${MIN_SAMPLE} de cada lado.`
    } else if (delta === null || Math.abs(delta) < 8) {
        reading = 'No se ve diferencia real entre los dos grupos.'
    } else {
        const better = params.higherIsBetter === false ? delta < 0 : delta > 0
        reading = better
            ? `Diferencia de ${Math.abs(delta)}% a favor de los días ${params.withLabel.toLowerCase()}.`
            : `Los días ${params.withLabel.toLowerCase()} dan ${Math.abs(delta)}% peor.`
    }

    return {
        id: params.id,
        question: params.question,
        withValue,
        withLabel: params.withLabel,
        withSample: params.withValues.length,
        withoutValue,
        withoutLabel: params.withoutLabel,
        withoutSample: params.withoutValues.length,
        unit: params.unit,
        delta,
        reliable,
        reading
    }
}

export async function getInsights(days = 90) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const today = getLocalDateStr()
    const from = addDaysToDateStr(today, -days)
    const uid = user.id
    const q = (table: string) => supabase.from(table).select('*').eq('user_id', uid)

    const [journalRes, habitLogsRes, habitsRes, trainLogsRes, commitmentsRes, tasksRes, eveningRes] =
        await Promise.all([
            q('journal_entries').gte('date', from),
            q('habit_logs').gte('completed_at', `${from}T00:00:00-03:00`),
            q('habits').eq('is_active', true),
            q('training_logs').gte('date', from),
            q('daily_commitments').gte('date', from),
            q('tasks').eq('status', 'Done').gte('updated_at', `${from}T00:00:00-03:00`),
            q('evening_ritual_logs').gte('date', from)
        ])

    const journal = journalRes.data || []
    const habitLogs = habitLogsRes.data || []
    const habits = habitsRes.data || []
    const trainLogs = (trainLogsRes.data || []).filter((l: any) => l.completed && l.date)
    const commitments = commitmentsRes.data || []
    const doneTasks = tasksRes.data || []
    const evenings = eveningRes.data || []

    // --- Índices por día ---
    const moodByDate = new Map<string, number>()
    for (const j of journal) {
        if (j.mood) moodByDate.set(j.date, j.mood)
    }
    for (const e of evenings) {
        if (e.day_rating && !moodByDate.has(e.date)) moodByDate.set(e.date, e.day_rating)
    }

    const trainedDates = new Set(trainLogs.map((l: any) => l.date))
    const commitmentDoneDates = new Set(
        commitments.filter((c: any) => c.status === 'done' || c.status === 'partial').map((c: any) => c.date)
    )
    const commitmentSignedDates = new Set(commitments.map((c: any) => c.date))
    const eveningDates = new Set(evenings.map((e: any) => e.date))

    const habitCountByDate = new Map<string, number>()
    for (const l of habitLogs) {
        const d = getLocalDateStr(new Date(l.completed_at))
        habitCountByDate.set(d, (habitCountByDate.get(d) || 0) + 1)
    }

    const tasksByDate = new Map<string, number>()
    for (const t of doneTasks) {
        const d = getLocalDateStr(new Date(t.updated_at))
        tasksByDate.set(d, (tasksByDate.get(d) || 0) + 1)
    }

    const allDates: string[] = []
    for (let i = 0; i < days; i++) allDates.push(addDaysToDateStr(today, -i))

    const correlations: Correlation[] = []

    // 1. Ánimo en días que entrenó vs días que no
    correlations.push(buildCorrelation({
        id: 'mood-training',
        question: '¿Cómo está tu ánimo los días que entrenás?',
        withValues: allDates.filter(d => moodByDate.has(d) && trainedDates.has(d)).map(d => moodByDate.get(d)!),
        withLabel: 'que entrenás',
        withoutValues: allDates.filter(d => moodByDate.has(d) && !trainedDates.has(d)).map(d => moodByDate.get(d)!),
        withoutLabel: 'que no entrenás',
        unit: '/5'
    }))

    // 2. Ánimo con compromiso cumplido vs no
    correlations.push(buildCorrelation({
        id: 'mood-commitment',
        question: '¿Cómo está tu ánimo los días que cumplís el compromiso?',
        withValues: allDates.filter(d => moodByDate.has(d) && commitmentDoneDates.has(d)).map(d => moodByDate.get(d)!),
        withLabel: 'que lo cumplís',
        withoutValues: allDates
            .filter(d => moodByDate.has(d) && commitmentSignedDates.has(d) && !commitmentDoneDates.has(d))
            .map(d => moodByDate.get(d)!),
        withoutLabel: 'que no lo cumplís',
        unit: '/5'
    }))

    // 3. Tareas cerradas con compromiso firmado vs sin
    correlations.push(buildCorrelation({
        id: 'tasks-commitment',
        question: '¿Cerrás más tareas los días que firmaste compromiso?',
        withValues: allDates.filter(d => commitmentSignedDates.has(d)).map(d => tasksByDate.get(d) || 0),
        withLabel: 'con compromiso firmado',
        withoutValues: allDates.filter(d => !commitmentSignedDates.has(d)).map(d => tasksByDate.get(d) || 0),
        withoutLabel: 'sin compromiso',
        unit: ' tareas'
    }))

    // 4. Hábitos cumplidos el día después de cerrar el día
    const afterEvening = allDates.filter(d => eveningDates.has(addDaysToDateStr(d, -1)))
    const afterNoEvening = allDates.filter(d => !eveningDates.has(addDaysToDateStr(d, -1)))
    correlations.push(buildCorrelation({
        id: 'habits-after-evening',
        question: '¿Cumplís más hábitos el día después de cerrar el día?',
        withValues: afterEvening.map(d => habitCountByDate.get(d) || 0),
        withLabel: 'después de cerrar el día',
        withoutValues: afterNoEvening.map(d => habitCountByDate.get(d) || 0),
        withoutLabel: 'después de no cerrarlo',
        unit: ' hábitos'
    }))

    // 5. Ánimo según cantidad de hábitos cumplidos
    const highHabitDays = allDates.filter(d => moodByDate.has(d) && (habitCountByDate.get(d) || 0) >= 2)
    const lowHabitDays = allDates.filter(d => moodByDate.has(d) && (habitCountByDate.get(d) || 0) < 2)
    correlations.push(buildCorrelation({
        id: 'mood-habits',
        question: '¿Tu ánimo sube con los días de más hábitos cumplidos?',
        withValues: highHabitDays.map(d => moodByDate.get(d)!),
        withLabel: 'con 2 o más hábitos',
        withoutValues: lowHabitDays.map(d => moodByDate.get(d)!),
        withoutLabel: 'con menos de 2',
        unit: '/5'
    }))

    // --- Series para los gráficos (últimas 12 semanas) ---
    const weeks: { week: string; mood: number | null; training: number; habits: number; commitments: number }[] = []
    for (let w = 11; w >= 0; w--) {
        const start = addDaysToDateStr(today, -(w * 7 + 6))
        const end = addDaysToDateStr(today, -(w * 7))
        const range = allDates.filter(d => d >= start && d <= end)
        const moods = range.filter(d => moodByDate.has(d)).map(d => moodByDate.get(d)!)
        weeks.push({
            week: start,
            mood: avg(moods),
            training: range.filter(d => trainedDates.has(d)).length,
            habits: range.reduce((s, d) => s + (habitCountByDate.get(d) || 0), 0),
            commitments: range.filter(d => commitmentDoneDates.has(d)).length
        })
    }

    return {
        correlations,
        weeks,
        coverage: {
            days,
            moodDays: moodByDate.size,
            trainedDays: trainedDates.size,
            commitmentDays: commitmentSignedDates.size,
            eveningDays: eveningDates.size,
            activeHabits: habits.length
        }
    }
}

/** Le pide al Copiloto que lea las correlaciones y diga qué haría con eso. */
export async function interpretInsights() {
    const [data, ctxProfile] = await Promise.all([
        getInsights(),
        getAssistantContextProfile().catch(() => null)
    ])

    const reliable = data.correlations.filter(c => c.reliable)
    if (!reliable.length) {
        return 'Todavía no hay datos suficientes para sacar conclusiones. Necesitás unas semanas registrando ánimo, entrenamientos y compromisos. Volvé cuando tengas al menos 4 días de cada tipo.'
    }

    const facts = reliable.map(c =>
        `${c.question} → ${c.withLabel}: ${c.withValue}${c.unit} (n=${c.withSample}); ${c.withoutLabel}: ${c.withoutValue}${c.unit} (n=${c.withoutSample}).`
    ).join('\n')

    const system = buildSystemPrompt('estratega', ctxProfile?.tone_preference)

    const prompt = `
Estas son correlaciones reales calculadas sobre los datos del usuario (últimos 90 días):

${facts}

Cobertura de datos: ánimo registrado ${data.coverage.moodDays} días, entrenamientos ${data.coverage.trainedDays}, compromisos firmados ${data.coverage.commitmentDays}, cierres de día ${data.coverage.eveningDays}.

En máximo 120 palabras:
1. Cuál de estas relaciones es la más accionable y por qué.
2. Qué haría concretamente con esa información esta semana.
3. Una advertencia honesta sobre qué NO se puede concluir de estos números (correlación no es causa; puede ser al revés).

Español rioplatense, corrido, sin títulos ni listas.`.trim()

    try {
        return await generateText(prompt, { system, temperature: 0.6, maxOutputTokens: 500 })
    } catch (e: any) {
        return `No pude interpretar los datos ahora: ${e?.message}`
    }
}
