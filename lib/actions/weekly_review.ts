'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { buildSystemPrompt } from '@/lib/assistantPersonas'
import { getAssistantContextProfile } from '@/lib/actions/assistant'
import { getLocalDateStr, getLocalDayOfWeek, addDaysToDateStr } from '@/lib/utils'

/**
 * Revisión semanal asistida.
 *
 * `weekly_plans` ya tenía campo `reflection` y nunca se llenaba, porque no había
 * ningún momento que lo pidiera. Esto lo convierte en un ritual con datos reales
 * adelante: qué se cumplió, qué no, y qué hay que SACAR del plan.
 */

/** Lunes de la semana que contiene a `date` (o de la actual). */
export async function getWeekStart(date?: string): Promise<string> {
    const base = date || getLocalDateStr()
    const [y, m, d] = base.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const isoDay = dow === 0 ? 7 : dow
    return addDaysToDateStr(base, 1 - isoDay)
}

function money(n: number): string {
    return `$${Math.round(n).toLocaleString('es-AR')}`
}

/** Resumen duro de la semana: solo números y hechos, sin interpretación. */
export async function buildWeekSummary(weekStart: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const weekEnd = addDaysToDateStr(weekStart, 6)
    const uid = user.id
    const q = (table: string) => supabase.from(table).select('*').eq('user_id', uid)

    const [
        doneRes, openRes, habitsRes, logsRes, commitmentsRes,
        trainLogsRes, trainPlanRes, financesRes, journalRes,
        eveningRes, objectivesRes, planRes
    ] = await Promise.all([
        q('tasks').eq('status', 'Done').gte('updated_at', `${weekStart}T00:00:00-03:00`).lte('updated_at', `${weekEnd}T23:59:59-03:00`),
        q('tasks').in('status', ['Todo', 'InProgress']),
        q('habits').eq('is_active', true),
        q('habit_logs').gte('completed_at', `${weekStart}T00:00:00-03:00`).lte('completed_at', `${weekEnd}T23:59:59-03:00`),
        q('daily_commitments').gte('date', weekStart).lte('date', weekEnd),
        q('training_logs').gte('date', weekStart).lte('date', weekEnd),
        q('training_plans').eq('status', 'active').limit(1).maybeSingle(),
        q('finances').eq('month_year', weekStart.slice(0, 7)),
        q('journal_entries').gte('date', weekStart).lte('date', weekEnd),
        q('evening_ritual_logs').gte('date', weekStart).lte('date', weekEnd),
        q('objectives').eq('status', 'Active'),
        q('weekly_plans').eq('week_start_date', weekStart).maybeSingle()
    ])

    const done = doneRes.data || []
    const open = openRes.data || []
    const habits = habitsRes.data || []
    const habitLogs = logsRes.data || []
    const commitments = commitmentsRes.data || []
    const trainLogs = trainLogsRes.data || []
    const trainPlan = trainPlanRes.data
    const finances = financesRes.data || []
    const journal = journalRes.data || []
    const evenings = eveningRes.data || []
    const objectives = objectivesRes.data || []
    const plan = planRes.data

    const today = getLocalDateStr()
    const overdue = open.filter((t: any) => t.due_date && t.due_date < today)

    const habitStats = habits.map((h: any) => {
        const count = habitLogs.filter((l: any) => l.habit_id === h.id).length
        return { title: h.title, count, target: h.frequency_type === 'custom_days' ? (h.frequency_days?.length || 7) : 7 }
    })

    const commitmentsDone = commitments.filter((c: any) => c.status === 'done').length
    const commitmentsPartial = commitments.filter((c: any) => c.status === 'partial').length
    const commitmentsSkipped = commitments.filter((c: any) => c.status === 'skipped').length

    const moods = journal.filter((j: any) => j.mood).map((j: any) => j.mood)
    const avgMood = moods.length ? Number((moods.reduce((s: number, m: number) => s + m, 0) / moods.length).toFixed(1)) : null

    const income = finances.filter((f: any) => f.type === 'Income').reduce((s: number, f: any) => s + Number(f.amount), 0)
    const expense = finances.filter((f: any) => f.type !== 'Income').reduce((s: number, f: any) => s + Number(f.amount), 0)

    const plannedSessions = trainPlan?.days_per_week || 0

    return {
        weekStart,
        weekEnd,
        tasks: {
            completed: done.length,
            completedTitles: done.slice(0, 12).map((t: any) => t.title),
            open: open.length,
            overdue: overdue.length,
            overdueTitles: overdue.slice(0, 8).map((t: any) => `${t.title} (venció ${t.due_date})`),
            orphans: open.filter((t: any) => !t.objective_id).length
        },
        habits: habitStats,
        commitments: {
            signed: commitments.length,
            done: commitmentsDone,
            partial: commitmentsPartial,
            skipped: commitmentsSkipped,
            failureReasons: commitments
                .filter((c: any) => c.status === 'skipped' && c.reflection)
                .map((c: any) => `"${c.action}" → ${c.reflection}`)
        },
        training: {
            completed: trainLogs.filter((l: any) => l.completed).length,
            planned: plannedSessions,
            ropeMinutes: trainLogs.reduce((s: number, l: any) => s + Number(l.rope_minutes || 0), 0)
        },
        mood: { avg: avgMood, entries: journal.length },
        eveningRituals: evenings.length,
        finances: { monthIncome: income, monthExpense: expense, monthBalance: income - expense },
        objectives: objectives.map((o: any) => ({ title: o.title, progress: o.progress_pct ?? 0, timeframe: o.timeframe })),
        weeklyGoals: plan?.weekly_goals || null,
        existingReview: plan?.ai_review || null,
        existingReflection: plan?.reflection || null
    }
}

export async function getWeeklyReview(weekStart: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function generateWeeklyReview(weekStart?: string): Promise<ActionResult<any>> {
    return runAction('generateWeeklyReview', () => buildWeeklyReview(weekStart))
}

async function buildWeeklyReview(weekStart?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const start = weekStart || await getWeekStart()
    const [summary, ctxProfile] = await Promise.all([
        buildWeekSummary(start),
        getAssistantContextProfile().catch(() => null)
    ])

    const facts = [
        `Semana del ${summary.weekStart} al ${summary.weekEnd}.`,
        `Tareas: cerró ${summary.tasks.completed}, quedan ${summary.tasks.open} abiertas, ${summary.tasks.overdue} vencidas, ${summary.tasks.orphans} sin objetivo asociado.`,
        summary.tasks.completedTitles.length ? `Cerró: ${summary.tasks.completedTitles.join(' | ')}.` : '',
        summary.tasks.overdueTitles.length ? `Vencidas: ${summary.tasks.overdueTitles.join(' | ')}.` : '',
        `Hábitos: ${summary.habits.map(h => `${h.title} ${h.count}/${h.target}`).join(' | ') || 'ninguno activo'}.`,
        `Compromisos diarios: firmó ${summary.commitments.signed}, cumplió ${summary.commitments.done}, a medias ${summary.commitments.partial}, salteó ${summary.commitments.skipped}.`,
        summary.commitments.failureReasons.length ? `Motivos de los que no cumplió: ${summary.commitments.failureReasons.join(' | ')}.` : '',
        `Entrenamiento: ${summary.training.completed} de ${summary.training.planned} sesiones${summary.training.ropeMinutes ? `, ${summary.training.ropeMinutes} min de soga` : ''}.`,
        `Ánimo promedio: ${summary.mood.avg ?? 'sin datos'} sobre 5 (${summary.mood.entries} entradas de journal).`,
        `Rituales nocturnos completados: ${summary.eveningRituals} de 7.`,
        `Finanzas del mes: ingresos ${money(summary.finances.monthIncome)}, gastos ${money(summary.finances.monthExpense)}, balance ${money(summary.finances.monthBalance)}.`,
        `Objetivos activos: ${summary.objectives.map(o => `${o.title} (${o.progress}%)`).join(' | ') || 'ninguno'}.`,
        summary.weeklyGoals ? `Metas que se había puesto para esta semana: ${summary.weeklyGoals}` : 'No se había puesto metas escritas para la semana.'
    ].filter(Boolean).join('\n')

    const system = buildSystemPrompt('estratega', ctxProfile?.tone_preference)

    const prompt = `
Estos son los datos duros de la semana del usuario:

<semana>
${facts}
</semana>

Hacé la revisión semanal. Reglas:
- Todo lo que digas tiene que apoyarse en un número de arriba. Nada genérico.
- En "recortar" tenés que nombrar algo concreto para ELIMINAR o postergar. Si todo lo que entra no saca nada, la semana que viene se repite el problema.
- "un_cambio" es UNA sola cosa para la semana que viene, chiquita y verificable.
- Si los compromisos vienen fallando por el mismo motivo, nombralo.
- Español rioplatense con voseo. Frases cortas.

Respondé SOLO con este JSON:
{
  "titular": "una frase que resuma la semana, honesta",
  "funciono": ["2 o 3 cosas que si funcionaron, con el dato que lo respalda"],
  "no_funciono": ["2 o 3 cosas que no, con el dato"],
  "patron": "el patrón que se repite y que el usuario probablemente no ve",
  "recortar": ["1 o 2 cosas concretas para sacar del plan"],
  "foco_semana": "el foco unico de la semana que viene",
  "un_cambio": "el unico cambio de sistema a probar, con criterio de exito"
}`.trim()

    const text = await generateText(prompt, { temperature: 0.6, maxOutputTokens: 1200, json: true })
    const review = parseJSON<any>(text)

    const payload = { ...review, generated_at: new Date().toISOString(), summary }

    const { error } = await supabase
        .from('weekly_plans')
        .upsert({
            user_id: user.id,
            week_start_date: start,
            ai_review: payload,
            reviewed_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_start_date' })

    if (error) throw error

    revalidatePath('/cierre')
    revalidatePath('/planner')
    return payload
}

export async function saveWeeklyReflection(weekStart: string, reflection: string, weeklyGoals?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const update: Record<string, any> = {
        user_id: user.id,
        week_start_date: weekStart,
        reflection: reflection || null
    }
    if (weeklyGoals !== undefined) update.weekly_goals = weeklyGoals || null

    const { error } = await supabase
        .from('weekly_plans')
        .upsert(update, { onConflict: 'user_id,week_start_date' })

    if (error) throw error
    revalidatePath('/cierre')
    revalidatePath('/planner')
}

/** ¿Hoy es domingo? Se usa para ofrecer la revisión en el momento justo. */
export async function isReviewDay(): Promise<boolean> {
    return getLocalDayOfWeek() === 0
}
