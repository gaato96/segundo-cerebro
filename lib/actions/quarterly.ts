'use server'

/**
 * Replanificación trimestral.
 *
 * El sistema funciona mientras lo alimentás todos los días. El problema es
 * volver después de una semana (o un mes) sin registrar nada: todo está
 * vencido, los hábitos en cero y no sabés por dónde agarrar. Esto es el
 * "reinicio ordenado": mira los datos reales, te hace decidir qué sigue y
 * qué se tira, y arma el plan del trimestre con lo que queda.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { createObjectiveFromSuggestion, type ObjectiveSuggestion, type KeyResult } from '@/lib/actions/okrs'
import { createRecurringTask } from '@/lib/actions/tasks'
import { getLocalDateStr, addDaysToDateStr } from '@/lib/utils'
import { planningQuarter, quarterInfo, quarterOf, daysSince, type QuarterInfo } from '@/lib/quarter'

// ============================================================
// TIPOS
// ============================================================

export interface ModuleActivity {
    key: string
    label: string
    href: string
    last: string | null
    daysAgo: number | null
}

export interface ReplanDiagnosis {
    generatedAt: string
    today: string
    /** Último día en que registraste CUALQUIER cosa. */
    lastActivity: string | null
    daysInactive: number | null
    /** Días distintos con al menos un registro en los últimos 90. */
    activeDays90: number
    modules: ModuleActivity[]
    tasks: {
        done90: number
        missed90: number
        open: { id: string; title: string; due_date: string | null; priority: number; overdue: boolean; objective_id: string | null }[]
    }
    habits: { id: string; title: string; logs30: number; expected30: number; pct: number }[]
    objectives: {
        id: string
        title: string
        timeframe: string
        year: number | null
        type: string
        progress_pct: number
        target_date: string | null
        expired: boolean
        key_results: KeyResult[]
    }[]
    training: {
        planName: string | null
        planEnd: string | null
        daysPerWeek: number
        sessions90: number
        parkSessions90: number
        matches90: number
    }
    weight: { first: number | null; firstDate: string | null; last: number | null; lastDate: string | null }
    journal: { entries90: number; avgMood: number | null }
    commitments: { signed90: number; done90: number }
    finances: { entries90: number; debtTotal: number }
    reading: { title: string; page: number; pages: number }[]
}

export interface ReplanReflection {
    funciono?: string
    no_funciono?: string
    aprendizaje?: string
    desconexion?: string
    palabra?: string
}

export interface PlanHabit {
    title: string
    frequency_type: 'daily' | 'x_per_week'
    frequency_times_per_week: number
    estimated_minutes: number
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
    why: string
}

export interface PlanRecurring {
    title: string
    recurrence_type: 'weekly' | 'biweekly' | 'monthly'
    /** ISO: 1 = lunes … 7 = domingo. */
    recurrence_days: number[]
    category: 'Work' | 'Personal'
    why: string
}

export interface PlanRoutineBlock {
    time: string
    activity: string
    category: string
}

export interface PlanMedia {
    title: string
    author?: string
    why: string
}

export interface QuarterPlan {
    tema: string
    diagnostico: string
    regla_regreso: string
    objetivos: ObjectiveSuggestion[]
    habitos: PlanHabit[]
    tareas_recurrentes: PlanRecurring[]
    horario: PlanRoutineBlock[]
    entrenamiento: { resumen: string; semana: { dia: string; que: string }[] }
    comidas: { enfoque: string; ideas: string[]; compras: string[] }
    series: PlanMedia[]
    peliculas: PlanMedia[]
    libros: PlanMedia[]
    recortar: string[]
    generated_at: string
}

export interface PlanSelection {
    objetivos: number[]
    habitos: number[]
    tareas_recurrentes: number[]
    horario: boolean
    series: number[]
    peliculas: number[]
    libros: number[]
}

export interface QuarterlyReviewRow {
    id: string
    year: number
    quarter: number
    status: 'draft' | 'done'
    step: number
    diagnosis: ReplanDiagnosis | null
    reflection: ReplanReflection
    decisions: Record<string, any>
    plan: QuarterPlan | null
    applied: Record<string, any>
    created_at: string
    updated_at: string
    completed_at: string | null
}

// ============================================================
// HELPERS
// ============================================================

async function requireUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')
    return { supabase, uid: user.id }
}

function dayOf(value: string | null | undefined): string | null {
    if (!value) return null
    // timestamptz → día local de Argentina
    if (value.length > 10) return getLocalDateStr(new Date(value))
    return value
}

function maxDate(dates: (string | null)[]): string | null {
    return dates.filter(Boolean).sort().pop() || null
}

function expectedPer30(h: any): number {
    switch (h.frequency_type) {
        case 'x_per_week': return Math.round((Number(h.frequency_times_per_week) || 3) * 30 / 7)
        case 'custom_days': return Math.round(((h.frequency_days?.length || 7) * 30) / 7)
        case 'x_per_day': return 30 * Math.max(Number(h.frequency_times_per_day) || 1, 1)
        default: return 30
    }
}

function revalidateAll() {
    for (const p of ['/replan', '/', '/okrs', '/tasks', '/habits', '/media', '/planner']) revalidatePath(p)
}

// ============================================================
// DIAGNÓSTICO
// ============================================================

export async function buildReplanDiagnosis(): Promise<ReplanDiagnosis> {
    const { supabase, uid } = await requireUser()
    const today = getLocalDateStr()
    const d90 = addDaysToDateStr(today, -90)
    const d30 = addDaysToDateStr(today, -30)
    const ts90 = `${d90}T00:00:00-03:00`
    const ts30 = `${d30}T00:00:00-03:00`

    const q = (table: string, cols = '*') => supabase.from(table).select(cols).eq('user_id', uid)
    // Si una tabla todavía no existe (migración sin correr) no rompemos el diagnóstico.
    const safe = async (p: PromiseLike<{ data: any; error: any }>) => {
        const { data, error } = await p
        return error ? [] : (data || [])
    }

    const [
        habitLogs, journal, morning, evening, commitments, finances,
        doneTasks, missedTasks, openTasks, habits, objectives, trainPlan,
        trainLogs, parkLogs, matches, weights, books, notes, debts,
        lastHabit, lastJournal, lastMorning, lastEvening, lastCommit, lastFin,
        lastDone, lastTrain, lastPark, lastWeight, lastBook, lastNote
    ] = await Promise.all([
        safe(q('habit_logs', 'habit_id, completed_at').gte('completed_at', ts90)),
        safe(q('journal_entries', 'date, mood').gte('date', d90)),
        safe(q('morning_ritual_logs', 'date').gte('date', d90)),
        safe(q('evening_ritual_logs', 'date').gte('date', d90)),
        safe(q('daily_commitments', 'date, status').gte('date', d90)),
        safe(q('finances', 'created_at').gte('created_at', ts90)),
        safe(q('tasks', 'updated_at').eq('status', 'Done').gte('updated_at', ts90)),
        safe(q('tasks', 'id').eq('status', 'Missed').gte('updated_at', ts90)),
        safe(q('tasks', 'id, title, due_date, priority, objective_id, is_recurring').in('status', ['Todo', 'InProgress']).order('due_date', { ascending: true, nullsFirst: false })),
        safe(q('habits', 'id, title, frequency_type, frequency_days, frequency_times_per_week, frequency_times_per_day, created_at').eq('is_active', true)),
        safe(q('objectives').eq('status', 'Active').order('created_at', { ascending: true })),
        safe(q('training_plans', 'name, end_date, days_per_week').eq('status', 'active').order('start_date', { ascending: false }).limit(1)),
        safe(q('training_logs', 'date, completed').gte('date', d90)),
        safe(q('park_logs', 'date, completed').gte('date', d90)),
        safe(q('football_matches', 'date').gte('date', d90)),
        safe(q('nutrition_progress', 'date, weight_kg').order('date', { ascending: true })),
        safe(q('books', 'title, current_page, page_count, status').eq('status', 'reading')),
        safe(q('mental_notes', 'created_at').gte('created_at', ts90)),
        safe(q('debts', 'remaining_amount')),
        // Último registro de cada módulo, sin importar hace cuánto
        safe(q('habit_logs', 'completed_at').order('completed_at', { ascending: false }).limit(1)),
        safe(q('journal_entries', 'date').order('date', { ascending: false }).limit(1)),
        safe(q('morning_ritual_logs', 'date').order('date', { ascending: false }).limit(1)),
        safe(q('evening_ritual_logs', 'date').order('date', { ascending: false }).limit(1)),
        safe(q('daily_commitments', 'date').order('date', { ascending: false }).limit(1)),
        safe(q('finances', 'created_at').order('created_at', { ascending: false }).limit(1)),
        safe(q('tasks', 'updated_at').eq('status', 'Done').order('updated_at', { ascending: false }).limit(1)),
        safe(q('training_logs', 'date').eq('completed', true).order('date', { ascending: false }).limit(1)),
        safe(q('park_logs', 'date').eq('completed', true).order('date', { ascending: false }).limit(1)),
        safe(q('nutrition_progress', 'date').order('date', { ascending: false }).limit(1)),
        safe(q('books', 'progress_updated_at').order('progress_updated_at', { ascending: false }).limit(1)),
        safe(q('mental_notes', 'created_at').order('created_at', { ascending: false }).limit(1))
    ])

    const mod = (key: string, label: string, href: string, last: string | null): ModuleActivity =>
        ({ key, label, href, last, daysAgo: daysSince(last, today) })

    const modules: ModuleActivity[] = [
        mod('ritual', 'Ritual matutino', '/ritual', dayOf(lastMorning[0]?.date)),
        mod('cierre', 'Cierre del día', '/cierre', dayOf(lastEvening[0]?.date)),
        mod('tareas', 'Tareas cerradas', '/tasks', dayOf(lastDone[0]?.updated_at)),
        mod('habitos', 'Hábitos', '/habits', dayOf(lastHabit[0]?.completed_at)),
        mod('compromisos', 'Compromisos', '/', dayOf(lastCommit[0]?.date)),
        mod('entreno', 'Entrenamiento', '/entrenamiento', maxDate([dayOf(lastTrain[0]?.date), dayOf(lastPark[0]?.date)])),
        mod('finanzas', 'Gastos', '/finances', dayOf(lastFin[0]?.created_at)),
        mod('journal', 'Journal', '/journal', dayOf(lastJournal[0]?.date)),
        mod('peso', 'Peso', '/meals/nutrition', dayOf(lastWeight[0]?.date)),
        mod('lectura', 'Lectura', '/lectura', dayOf(lastBook[0]?.progress_updated_at)),
        mod('inbox', 'Inbox', '/inbox', dayOf(lastNote[0]?.created_at))
    ]

    const lastActivity = maxDate(modules.map(m => m.last))

    const activeSet = new Set<string>()
    const add = (v: string | null) => { if (v && v >= d90) activeSet.add(v) }
    habitLogs.forEach((l: any) => add(dayOf(l.completed_at)))
    journal.forEach((j: any) => add(j.date))
    morning.forEach((r: any) => add(r.date))
    evening.forEach((r: any) => add(r.date))
    commitments.forEach((c: any) => add(c.date))
    finances.forEach((f: any) => add(dayOf(f.created_at)))
    doneTasks.forEach((t: any) => add(dayOf(t.updated_at)))
    trainLogs.forEach((l: any) => l.completed && add(l.date))
    parkLogs.forEach((l: any) => l.completed && add(l.date))
    notes.forEach((n: any) => add(dayOf(n.created_at)))

    const logs30 = habitLogs.filter((l: any) => l.completed_at >= ts30)
    const habitStats = habits.map((h: any) => {
        const count = logs30.filter((l: any) => l.habit_id === h.id).length
        // Un hábito creado hace 10 días no puede deber 30 días de registros.
        const age = Math.min(daysSince(dayOf(h.created_at), today) ?? 30, 30)
        const expected = Math.max(Math.round(expectedPer30(h) * Math.max(age, 1) / 30), 1)
        return { id: h.id, title: h.title, logs30: count, expected30: expected, pct: Math.min(Math.round((count / expected) * 100), 100) }
    })

    const moods = journal.filter((j: any) => j.mood).map((j: any) => Number(j.mood))
    const plan = trainPlan[0]

    return {
        generatedAt: new Date().toISOString(),
        today,
        lastActivity,
        daysInactive: daysSince(lastActivity, today),
        activeDays90: activeSet.size,
        modules,
        tasks: {
            done90: doneTasks.length,
            missed90: missedTasks.length,
            // Las plantillas de recurrentes no son tareas para limpiar.
            open: openTasks.filter((t: any) => !t.is_recurring).map((t: any) => ({
                id: t.id,
                title: t.title,
                due_date: t.due_date,
                priority: t.priority ?? 2,
                overdue: !!t.due_date && t.due_date < today,
                objective_id: t.objective_id
            }))
        },
        habits: habitStats,
        objectives: objectives.map((o: any) => ({
            id: o.id,
            title: o.title,
            timeframe: o.timeframe,
            year: o.year ?? null,
            type: o.type,
            progress_pct: o.progress_pct ?? 0,
            target_date: o.target_date,
            expired: !!o.target_date && o.target_date < today,
            key_results: Array.isArray(o.key_results) ? o.key_results : []
        })),
        training: {
            planName: plan?.name ?? null,
            planEnd: plan?.end_date ?? null,
            daysPerWeek: plan?.days_per_week ?? 0,
            sessions90: trainLogs.filter((l: any) => l.completed).length,
            parkSessions90: parkLogs.filter((l: any) => l.completed).length,
            matches90: matches.length
        },
        weight: {
            first: weights[0] ? Number(weights[0].weight_kg) : null,
            firstDate: weights[0]?.date ?? null,
            last: weights.length ? Number(weights[weights.length - 1].weight_kg) : null,
            lastDate: weights.length ? weights[weights.length - 1].date : null
        },
        journal: {
            entries90: journal.length,
            avgMood: moods.length ? Number((moods.reduce((a: number, b: number) => a + b, 0) / moods.length).toFixed(1)) : null
        },
        commitments: {
            signed90: commitments.length,
            done90: commitments.filter((c: any) => c.status === 'done').length
        },
        finances: {
            entries90: finances.length,
            debtTotal: debts.reduce((s: number, d: any) => s + Math.max(Number(d.remaining_amount) || 0, 0), 0)
        },
        reading: books.map((b: any) => ({ title: b.title, page: b.current_page, pages: b.page_count }))
    }
}

// ============================================================
// ESTADO DE LA PÁGINA
// ============================================================

export async function getReplanState(year?: number, quarter?: number) {
    const { supabase, uid } = await requireUser()
    const today = getLocalDateStr()
    const target = year && quarter ? quarterInfo(year, quarter, today) : planningQuarter(today)

    const [diagnosis, reviewRes, historyRes] = await Promise.all([
        buildReplanDiagnosis(),
        supabase.from('quarterly_reviews').select('*').eq('user_id', uid).eq('year', target.year).eq('quarter', target.quarter).maybeSingle(),
        supabase.from('quarterly_reviews').select('year, quarter, status, completed_at, reflection, plan').eq('user_id', uid).order('year', { ascending: false }).order('quarter', { ascending: false }).limit(8)
    ])

    return {
        target,
        current: quarterOf(today),
        diagnosis,
        review: (reviewRes.data as QuarterlyReviewRow | null) ?? null,
        history: (historyRes.data || []) as Pick<QuarterlyReviewRow, 'year' | 'quarter' | 'status' | 'completed_at' | 'reflection' | 'plan'>[],
        // Si la tabla no existe, la página avisa qué migración falta.
        missingMigration: !!reviewRes.error && /quarterly_reviews/.test(reviewRes.error.message)
    }
}

/** Guarda en qué paso quedaste y lo que escribiste. Crea la revisión si no existe. */
export async function saveReplanProgress(
    year: number,
    quarter: number,
    patch: { step?: number; reflection?: ReplanReflection; decisions?: Record<string, any>; diagnosis?: ReplanDiagnosis }
): Promise<ActionResult<true>> {
    return runAction('saveReplanProgress', async () => {
        const { supabase, uid } = await requireUser()
        const { data: existing } = await supabase
            .from('quarterly_reviews')
            .select('id, decisions, reflection, step')
            .eq('user_id', uid).eq('year', year).eq('quarter', quarter)
            .maybeSingle()

        const row: Record<string, any> = {
            user_id: uid,
            year,
            quarter,
            updated_at: new Date().toISOString()
        }
        if (patch.step !== undefined) row.step = Math.max(patch.step, existing?.step ?? 0)
        if (patch.reflection) row.reflection = { ...(existing?.reflection || {}), ...patch.reflection }
        if (patch.decisions) row.decisions = { ...(existing?.decisions || {}), ...patch.decisions }
        if (patch.diagnosis) row.diagnosis = patch.diagnosis

        const { error } = await supabase.from('quarterly_reviews').upsert(row, { onConflict: 'user_id,year,quarter' })
        if (error) throw new Error(error.message)
        return true as const
    })
}

// ============================================================
// PASO: OBJETIVOS
// ============================================================

export type ObjectiveDecision = 'keep' | 'complete' | 'cancel'

/**
 * Lo que decidiste con cada objetivo activo. "Seguir" lo pasa al trimestre
 * que estás planificando y, si la fecha meta ya venció, la corre al final.
 */
export async function applyObjectiveDecisions(
    year: number,
    quarter: number,
    decisions: Record<string, ObjectiveDecision>
): Promise<ActionResult<{ kept: number; completed: number; cancelled: number }>> {
    return runAction('applyObjectiveDecisions', async () => {
        const { supabase, uid } = await requireUser()
        const target = quarterInfo(year, quarter)
        const today = getLocalDateStr()
        let kept = 0, completed = 0, cancelled = 0

        for (const [id, decision] of Object.entries(decisions)) {
            if (decision === 'complete') {
                await supabase.from('objectives').update({ status: 'Completed' }).eq('id', id).eq('user_id', uid)
                completed++
            } else if (decision === 'cancel') {
                await supabase.from('objectives').update({ status: 'Cancelled' }).eq('id', id).eq('user_id', uid)
                cancelled++
            } else {
                const { data: obj } = await supabase.from('objectives').select('timeframe, target_date').eq('id', id).eq('user_id', uid).maybeSingle()
                const update: Record<string, any> = { year: target.year }
                if (obj?.timeframe !== 'Year') update.timeframe = target.label
                if (!obj?.target_date || obj.target_date < today) update.target_date = target.end
                await supabase.from('objectives').update(update).eq('id', id).eq('user_id', uid)
                kept++
            }
        }

        await saveReplanProgress(year, quarter, { decisions: { objectives: decisions } })
        revalidateAll()
        return { kept, completed, cancelled }
    })
}

// ============================================================
// PASO: LIMPIEZA
// ============================================================

/**
 * "Bancarrota de tareas": lo vencido se reprograma a propósito o se suelta.
 * Volver con 30 tareas vencidas mirándote es la forma más rápida de no volver.
 */
export async function cleanupTasks(
    ids: string[],
    action: 'reschedule' | 'cancel' | 'done',
    date?: string
): Promise<ActionResult<number>> {
    return runAction('cleanupTasks', async () => {
        if (!ids.length) return 0
        const { supabase, uid } = await requireUser()
        const update: Record<string, any> =
            action === 'cancel' ? { status: 'Cancelled' }
                : action === 'done' ? { status: 'Done' }
                    : { due_date: date || getLocalDateStr(), planned_date: null }

        const { error, count } = await supabase
            .from('tasks')
            .update(update, { count: 'exact' })
            .in('id', ids)
            .eq('user_id', uid)
        if (error) throw new Error(error.message)
        revalidateAll()
        return count ?? ids.length
    })
}

/** Pausar un hábito no es fallar: es sacarlo del tablero hasta que tenga lugar. */
export async function setHabitsActive(ids: string[], active: boolean): Promise<ActionResult<number>> {
    return runAction('setHabitsActive', async () => {
        if (!ids.length) return 0
        const { supabase, uid } = await requireUser()
        const { error } = await supabase.from('habits').update({ is_active: active }).in('id', ids).eq('user_id', uid)
        if (error) throw new Error(error.message)
        revalidateAll()
        return ids.length
    })
}

// ============================================================
// PASO: PLAN DEL TRIMESTRE (IA)
// ============================================================

const TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RANGE_RE = /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/

function str(v: any, max = 300): string {
    return String(v ?? '').trim().slice(0, max)
}

function arr<T>(v: any, max: number, map: (x: any) => T | null): T[] {
    return (Array.isArray(v) ? v : []).slice(0, max).map(map).filter(Boolean) as T[]
}

function facts(d: ReplanDiagnosis, target: QuarterInfo): string {
    const inactive = d.modules.filter(m => m.daysAgo === null || m.daysAgo > 14).map(m => `${m.label} (${m.last ? `hace ${m.daysAgo} días` : 'nunca'})`)
    return [
        `Trimestre a planificar: ${target.name} (${target.start} → ${target.end}). Quedan ${target.daysLeft} días.`,
        `Último registro de cualquier cosa: ${d.lastActivity ?? 'nunca'}${d.daysInactive ? ` (hace ${d.daysInactive} días)` : ''}. Días activos en los últimos 90: ${d.activeDays90}.`,
        inactive.length ? `Módulos abandonados (más de 14 días): ${inactive.join(' | ')}.` : '',
        `Tareas (90 días): ${d.tasks.done90} cerradas, ${d.tasks.missed90} perdidas. Abiertas ahora: ${d.tasks.open.length} (${d.tasks.open.filter(t => t.overdue).length} vencidas).`,
        `Hábitos (últimos 30 días): ${d.habits.map(h => `${h.title} ${h.logs30}/${h.expected30}`).join(' | ') || 'ninguno activo'}.`,
        `Objetivos activos: ${d.objectives.map(o => `${o.title} ${o.progress_pct}%${o.expired ? ' (VENCIDO)' : ''}`).join(' | ') || 'ninguno'}.`,
        `Entrenamiento (90 días): ${d.training.sessions90} sesiones de fuerza, ${d.training.parkSessions90} de parque, ${d.training.matches90} partidos. Plan activo: ${d.training.planName ?? 'ninguno'}${d.training.planEnd ? ` (termina ${d.training.planEnd})` : ''}.`,
        d.weight.last ? `Peso: ${d.weight.first}kg (${d.weight.firstDate}) → ${d.weight.last}kg (${d.weight.lastDate}).` : 'Sin registros de peso.',
        `Journal: ${d.journal.entries90} entradas, ánimo promedio ${d.journal.avgMood ?? 's/d'}/5. Compromisos: ${d.commitments.done90}/${d.commitments.signed90} cumplidos.`,
        `Lectura en curso: ${d.reading.map(b => `${b.title} pág ${b.page}/${b.pages}`).join(' | ') || 'nada'}.`
    ].filter(Boolean).join('\n')
}

export async function generateQuarterPlan(year: number, quarter: number): Promise<ActionResult<QuarterPlan>> {
    return runAction('generateQuarterPlan', async () => {
        const { supabase, uid } = await requireUser()
        const target = quarterInfo(year, quarter)

        const [snapshot, diagnosis, reviewRes, mediaRes] = await Promise.all([
            buildBrainSnapshot(),
            buildReplanDiagnosis(),
            supabase.from('quarterly_reviews').select('reflection').eq('user_id', uid).eq('year', year).eq('quarter', quarter).maybeSingle(),
            supabase.from('media_backlog').select('type, title, status, rating').eq('user_id', uid)
        ])

        const reflection: ReplanReflection = reviewRes.data?.reflection || {}
        const media = mediaRes.data || []
        const listOf = (type: string, status: string) => media.filter((m: any) => m.type === type && m.status === status).map((m: any) => m.title).join(', ') || 'nada'
        const liked = media.filter((m: any) => Number(m.rating) >= 8).map((m: any) => `${m.title} (${m.rating})`).join(', ') || 'sin calificaciones'

        const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

<diagnostico_trimestral>
${facts(diagnosis, target)}
</diagnostico_trimestral>

<reflexion_del_usuario>
Qué funcionó: ${reflection.funciono || '(no escribió)'}
Qué no funcionó: ${reflection.no_funciono || '(no escribió)'}
Qué aprendió: ${reflection.aprendizaje || '(no escribió)'}
Por qué se desconectó del sistema: ${reflection.desconexion || '(no escribió)'}
Palabra para el trimestre: ${reflection.palabra || '(no eligió)'}
</reflexion_del_usuario>

<entretenimiento>
Series pendientes: ${listOf('Series', 'Backlog')}
Series en curso: ${listOf('Series', 'Active')}
Películas pendientes: ${listOf('Movie', 'Backlog')}
Libros en curso: ${listOf('Book', 'Active')}
Lo que más le gustó: ${liked}
</entretenimiento>

Hoy es ${diagnosis.today}. Sos su estratega personal y vas a armar el plan de ${target.name}, que termina el ${target.end} (quedan ${target.daysLeft} días).

Contexto clave: el usuario viene de un período sin registrar nada. NO le armes el plan de alguien disciplinado; armá el plan de alguien que está volviendo. Poco, chico y que se pueda cumplir aunque tenga una semana mala.

Reglas duras:
- Máximo 3 objetivos SMART. Con ${target.daysLeft} días, si alguno no entra, no lo pongas. Cada uno con 2 o 3 resultados clave con NÚMERO y unidad, "target_date" YYYY-MM-DD antes del ${target.end}, y entre 2 y 4 tareas de una sola sesión con la semana del plan. "habits" de cada objetivo va VACÍO: los hábitos van aparte.
- Hábitos: máximo 4, de 15 minutos o menos, que encajen en sus horarios reales. Preferí "x_per_week". Si ya tiene un hábito que sirve, no lo dupliques.
- Tareas recurrentes: entre 2 y 4 (por ejemplo revisión semanal el domingo, pagar deudas, prospectar). recurrence_days en ISO (1 lunes ... 7 domingo).
- Horario: un día tipo de bloques "HH:MM - HH:MM" que respete su trabajo y su vida con su hijo. Que entre el entrenamiento.
- Entrenamiento: alineado con el plan que ya tiene activo (fuerza en casa y plan de parque). No inventes otro programa: decí cómo encajarlo en la semana.
- Comidas: realista para su presupuesto y para cocinar también para un nene de 2 años.
- Series, películas y libros: primero de lo que YA tiene pendiente, y como mucho 2 nuevos por categoría, basados en lo que calificó alto. Libros: que ayuden a sus objetivos.
- "recortar": 2 o 3 cosas concretas para dejar de hacer o pausar (módulos, hábitos, proyectos).
- "regla_regreso": una regla corta para la próxima vez que se desconecte (qué hacer el primer día que vuelve).
- Español rioplatense con voseo. Directo, sin relleno.

Respondé SOLO con este JSON:
{
  "tema": "nombre corto del trimestre",
  "diagnostico": "2 o 3 frases honestas sobre dónde está parado, con datos",
  "regla_regreso": "...",
  "objetivos": [{ "title": "...", "description": "...", "timeframe": "${target.label}", "type": "Personal", "target_date": "${target.end}", "key_results": [{ "title": "...", "metric": "...", "target": 10, "current": 0, "unit": "..." }], "smart_notes": "...", "why": "...", "risk": "...", "tasks": [{ "title": "...", "priority": 1, "week": 1 }], "habits": [] }],
  "habitos": [{ "title": "...", "frequency_type": "x_per_week", "frequency_times_per_week": 3, "estimated_minutes": 10, "time_of_day": "morning", "why": "..." }],
  "tareas_recurrentes": [{ "title": "...", "recurrence_type": "weekly", "recurrence_days": [7], "category": "Personal", "why": "..." }],
  "horario": [{ "time": "05:00 - 07:00", "activity": "...", "category": "Trabajo" }],
  "entrenamiento": { "resumen": "...", "semana": [{ "dia": "Lunes", "que": "..." }] },
  "comidas": { "enfoque": "...", "ideas": ["..."], "compras": ["..."] },
  "series": [{ "title": "...", "why": "..." }],
  "peliculas": [{ "title": "...", "why": "..." }],
  "libros": [{ "title": "...", "author": "...", "why": "..." }],
  "recortar": ["..."]
}`.trim()

        const text = await generateText(prompt, { temperature: 0.6, maxOutputTokens: 7000, json: true })
        const p = parseJSON<any>(text)

        const media3 = (x: any): PlanMedia | null => {
            const title = str(x?.title, 160)
            return title ? { title, author: str(x?.author, 120) || undefined, why: str(x?.why, 300) } : null
        }

        const plan: QuarterPlan = {
            tema: str(p.tema, 120) || target.name,
            diagnostico: str(p.diagnostico, 800),
            regla_regreso: str(p.regla_regreso, 400),
            objetivos: arr(p.objetivos, 3, (o: any): ObjectiveSuggestion | null => {
                const title = str(o?.title, 200)
                if (!title) return null
                const td = DATE_RE.test(o?.target_date || '') && o.target_date <= target.end ? o.target_date : target.end
                return {
                    title,
                    description: str(o.description, 600),
                    timeframe: target.label,
                    type: o.type === 'Professional' ? 'Professional' : 'Personal',
                    target_date: td,
                    key_results: arr(o.key_results, 4, (kr: any) => str(kr?.title) ? {
                        title: str(kr.title, 160), metric: str(kr.metric, 100),
                        target: Number(kr.target) || 0, current: Number(kr.current) || 0, unit: str(kr.unit, 40)
                    } : null),
                    smart_notes: str(o.smart_notes, 800),
                    why: str(o.why, 500),
                    risk: str(o.risk, 400),
                    tasks: arr(o.tasks, 5, (t: any) => str(t?.title) ? {
                        title: str(t.title, 200),
                        priority: ([1, 2, 3].includes(t.priority) ? t.priority : 2) as 1 | 2 | 3,
                        week: Math.max(Number(t.week) || 1, 1)
                    } : null),
                    habits: []
                }
            }),
            habitos: arr(p.habitos, 4, (h: any): PlanHabit | null => str(h?.title) ? {
                title: str(h.title, 120),
                frequency_type: h.frequency_type === 'daily' ? 'daily' : 'x_per_week',
                frequency_times_per_week: Math.min(Math.max(Number(h.frequency_times_per_week) || 3, 1), 7),
                estimated_minutes: Math.min(Math.max(Number(h.estimated_minutes) || 10, 1), 60),
                time_of_day: TIME_OF_DAY.includes(h.time_of_day) ? h.time_of_day : 'anytime',
                why: str(h.why, 300)
            } : null),
            tareas_recurrentes: arr(p.tareas_recurrentes, 4, (r: any): PlanRecurring | null => str(r?.title) ? {
                title: str(r.title, 200),
                recurrence_type: ['weekly', 'biweekly', 'monthly'].includes(r.recurrence_type) ? r.recurrence_type : 'weekly',
                recurrence_days: (Array.isArray(r.recurrence_days) ? r.recurrence_days : []).map(Number).filter((n: number) => n >= 1 && n <= 7).slice(0, 7),
                category: r.category === 'Work' ? 'Work' : 'Personal',
                why: str(r.why, 300)
            } : null),
            horario: arr(p.horario, 14, (b: any): PlanRoutineBlock | null => {
                const time = str(b?.time, 20)
                const activity = str(b?.activity, 120)
                return TIME_RANGE_RE.test(time) && activity ? { time, activity, category: str(b.category, 30) || 'Personal' } : null
            }),
            entrenamiento: {
                resumen: str(p.entrenamiento?.resumen, 800),
                semana: arr(p.entrenamiento?.semana, 7, (s: any) => str(s?.dia) ? { dia: str(s.dia, 20), que: str(s.que, 200) } : null)
            },
            comidas: {
                enfoque: str(p.comidas?.enfoque, 600),
                ideas: arr(p.comidas?.ideas, 10, (x: any) => str(x, 160) || null),
                compras: arr(p.comidas?.compras, 15, (x: any) => str(x, 100) || null)
            },
            series: arr(p.series, 5, media3),
            peliculas: arr(p.peliculas, 5, media3),
            libros: arr(p.libros, 4, media3),
            recortar: arr(p.recortar, 4, (x: any) => str(x, 240) || null),
            generated_at: new Date().toISOString()
        }

        if (!plan.objetivos.length && !plan.habitos.length) {
            throw new Error('La IA devolvió un plan vacío. Probá de nuevo en unos segundos.')
        }

        const { error } = await supabase.from('quarterly_reviews').upsert({
            user_id: uid, year, quarter, plan, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,year,quarter' })
        if (error) throw new Error(error.message)

        revalidatePath('/replan')
        return plan
    })
}

/** Convierte lo que tildaste del plan en objetivos, hábitos, tareas y backlog reales. */
export async function applyQuarterPlan(
    year: number,
    quarter: number,
    selection: PlanSelection
): Promise<ActionResult<Record<string, number>>> {
    return runAction('applyQuarterPlan', async () => {
        const { supabase, uid } = await requireUser()

        const { data: review, error: reviewError } = await supabase
            .from('quarterly_reviews').select('plan, applied')
            .eq('user_id', uid).eq('year', year).eq('quarter', quarter).maybeSingle()
        if (reviewError) throw new Error(reviewError.message)
        const plan = review?.plan as QuarterPlan | null
        if (!plan) throw new Error('Todavía no hay un plan generado para este trimestre.')

        const pick = <T,>(list: T[], idx: number[]) => idx.filter(i => i >= 0 && i < list.length).map(i => list[i])
        const counts: Record<string, number> = { objetivos: 0, tareas: 0, habitos: 0, recurrentes: 0, horario: 0, media: 0 }
        const applied: Record<string, any> = { ...(review?.applied || {}) }

        // Objetivos (con sus tareas). Los hábitos van por su lado.
        for (const o of pick(plan.objetivos, selection.objetivos)) {
            const res = await createObjectiveFromSuggestion(o, { withTasks: true, withHabits: false })
            if ('error' in res && res.error) throw new Error(`Objetivo "${o.title}": ${res.error}`)
            if ('objectiveId' in res && res.objectiveId) {
                await supabase.from('objectives').update({ year }).eq('id', res.objectiveId).eq('user_id', uid)
                counts.objetivos++
                counts.tareas += res.tasksCreated || 0
            }
        }

        // Hábitos nuevos (sin duplicar por título)
        const habits = pick(plan.habitos, selection.habitos)
        if (habits.length) {
            const { data: existing } = await supabase.from('habits').select('title').eq('user_id', uid).eq('is_active', true)
            const have = new Set((existing || []).map((h: any) => h.title.toLowerCase().trim()))
            const rows = habits.filter(h => !have.has(h.title.toLowerCase().trim())).map(h => ({
                user_id: uid,
                title: h.title,
                frequency: 'daily',
                goal_count: 1,
                color_hex: '#14b8a6',
                estimated_minutes: h.estimated_minutes,
                time_of_day: h.time_of_day,
                icon: 'flame',
                is_active: true,
                frequency_type: h.frequency_type,
                frequency_days: [],
                frequency_times_per_day: 1,
                frequency_times_per_week: h.frequency_times_per_week
            }))
            if (rows.length) {
                const { error } = await supabase.from('habits').insert(rows)
                if (error) throw new Error(`Hábitos: ${error.message}`)
                counts.habitos = rows.length
            }
        }

        // Tareas recurrentes
        for (const r of pick(plan.tareas_recurrentes, selection.tareas_recurrentes)) {
            const fd = new FormData()
            fd.set('title', r.title)
            fd.set('description', r.why)
            fd.set('priority', '2')
            fd.set('category', r.category)
            fd.set('energy_level', 'Low Energy')
            fd.set('recurrence_type', r.recurrence_type)
            fd.set('recurrence_days', (r.recurrence_days.length ? r.recurrence_days : [1]).join(','))
            fd.set('recurrence_interval', '1')
            try {
                await createRecurringTask(fd)
                counts.recurrentes++
            } catch (e: any) {
                throw new Error(`Recurrente "${r.title}": ${e?.message || e}`)
            }
        }

        // Horario ideal: se reemplaza, pero el anterior queda guardado.
        if (selection.horario && plan.horario.length) {
            const { data: profile } = await supabase.from('profiles').select('ideal_routine_json').eq('id', uid).single()
            if (!applied.previousRoutine) applied.previousRoutine = profile?.ideal_routine_json || []
            const { error } = await supabase.from('profiles').update({ ideal_routine_json: plan.horario }).eq('id', uid)
            if (error) throw new Error(`Horario: ${error.message}`)
            counts.horario = 1
        }

        // Series, películas y libros al backlog (sin duplicar)
        const mediaRows: { type: string; item: PlanMedia }[] = [
            ...pick(plan.series, selection.series).map(item => ({ type: 'Series', item })),
            ...pick(plan.peliculas, selection.peliculas).map(item => ({ type: 'Movie', item })),
            ...pick(plan.libros, selection.libros).map(item => ({ type: 'Book', item }))
        ]
        if (mediaRows.length) {
            const { data: existing } = await supabase.from('media_backlog').select('title').eq('user_id', uid)
            const have = new Set((existing || []).map((m: any) => m.title.toLowerCase().trim()))
            const rows = mediaRows.filter(m => !have.has(m.item.title.toLowerCase().trim())).map(m => ({
                user_id: uid,
                type: m.type,
                title: m.item.title,
                author_or_studio: m.item.author || null,
                status: 'Backlog',
                progress: m.type === 'Series' ? 'S1 Ep 1' : m.type === 'Book' ? 'Pág 1' : '',
                notes: m.item.why ? `Recomendado en la replanificación ${year} Q${quarter}: ${m.item.why}` : ''
            }))
            if (rows.length) {
                const { error } = await supabase.from('media_backlog').insert(rows)
                if (error) throw new Error(`Entretenimiento: ${error.message}`)
                counts.media = rows.length
            }
        }

        applied.selection = selection
        applied.counts = counts
        applied.applied_at = new Date().toISOString()
        await supabase.from('quarterly_reviews').update({ applied, updated_at: new Date().toISOString() })
            .eq('user_id', uid).eq('year', year).eq('quarter', quarter)

        revalidateAll()
        return counts
    })
}

/** Vuelve a poner el horario ideal que tenías antes de aplicar el plan. */
export async function restorePreviousRoutine(year: number, quarter: number): Promise<ActionResult<true>> {
    return runAction('restorePreviousRoutine', async () => {
        const { supabase, uid } = await requireUser()
        const { data } = await supabase.from('quarterly_reviews').select('applied').eq('user_id', uid).eq('year', year).eq('quarter', quarter).maybeSingle()
        const prev = data?.applied?.previousRoutine
        if (!Array.isArray(prev)) throw new Error('No hay un horario anterior guardado.')
        const { error } = await supabase.from('profiles').update({ ideal_routine_json: prev }).eq('id', uid)
        if (error) throw new Error(error.message)
        revalidatePath('/')
        return true as const
    })
}

export async function completeReplan(year: number, quarter: number): Promise<ActionResult<true>> {
    return runAction('completeReplan', async () => {
        const { supabase, uid } = await requireUser()
        const diagnosis = await buildReplanDiagnosis()
        const { error } = await supabase.from('quarterly_reviews').upsert({
            user_id: uid, year, quarter,
            status: 'done',
            step: 5,
            diagnosis,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,year,quarter' })
        if (error) throw new Error(error.message)
        revalidateAll()
        return true as const
    })
}

// ============================================================
// AVISO EN EL DASHBOARD
// ============================================================

export interface ReplanNudge {
    kind: 'returning' | 'quarter_start' | 'quarter_ending' | 'checkin'
    title: string
    body: string
    cta: string
}

/**
 * Cuándo te avisa el dashboard:
 * - Volviste después de 7+ días sin registrar nada → "modo regreso".
 * - El trimestre que toca planificar no tiene revisión cerrada.
 * - Ya la hiciste, pero pasó un mes → chequeo rápido de progreso.
 */
export async function getReplanNudge(): Promise<ReplanNudge | null> {
    try {
        const { supabase, uid } = await requireUser()
        const today = getLocalDateStr()
        const target = planningQuarter(today)
        const current = quarterOf(today)

        const [reviewRes, ...lasts] = await Promise.all([
            supabase.from('quarterly_reviews').select('status, completed_at').eq('user_id', uid).eq('year', target.year).eq('quarter', target.quarter).maybeSingle(),
            supabase.from('habit_logs').select('completed_at').eq('user_id', uid).order('completed_at', { ascending: false }).limit(1),
            supabase.from('morning_ritual_logs').select('date').eq('user_id', uid).order('date', { ascending: false }).limit(1),
            supabase.from('evening_ritual_logs').select('date').eq('user_id', uid).order('date', { ascending: false }).limit(1),
            supabase.from('journal_entries').select('date').eq('user_id', uid).order('date', { ascending: false }).limit(1),
            supabase.from('finances').select('created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
            supabase.from('tasks').select('updated_at').eq('user_id', uid).eq('status', 'Done').order('updated_at', { ascending: false }).limit(1)
        ])

        // Si la migración 024 no corrió, no mostramos nada.
        if (reviewRes.error) return null

        const last = maxDate(lasts.map((r: any) => {
            const row = r.data?.[0]
            return dayOf(row?.completed_at || row?.date || row?.created_at || row?.updated_at || null)
        }))
        const inactive = daysSince(last, today)
        const review = reviewRes.data

        if (inactive !== null && inactive >= 7 && review?.status !== 'done') {
            return {
                kind: 'returning',
                title: `Hace ${inactive} días que no registrás nada`,
                body: 'No hace falta ponerse al día con todo. En 20 minutos ordenamos lo que quedó, soltamos lo vencido y armamos un plan chico para lo que queda del trimestre.',
                cta: 'Volver a ordenarme'
            }
        }

        if (!review || review.status !== 'done') {
            const ending = target.year !== current.year || target.quarter !== current.quarter
            return {
                kind: ending ? 'quarter_ending' : 'quarter_start',
                title: ending ? `${current.name} termina en ${current.daysLeft} días` : `Todavía no planificaste ${target.name}`,
                body: ending
                    ? `Es el momento de cerrar el trimestre y armar ${target.name} antes de que arranque.`
                    : `Quedan ${target.daysLeft} días del trimestre. Revisá cómo venís y decidí en qué enfocarte hasta el ${target.end.slice(8)}/${target.end.slice(5, 7)}.`,
                cta: 'Hacer la replanificación'
            }
        }

        const since = daysSince(dayOf(review.completed_at), today)
        if (since !== null && since >= 30 && since % 30 < 7) {
            return {
                kind: 'checkin',
                title: 'Chequeo mensual del trimestre',
                body: `Hiciste la replanificación hace ${since} días. Mirá si los objetivos avanzan al ritmo del calendario.`,
                cta: 'Ver el progreso'
            }
        }

        return null
    } catch {
        return null
    }
}
