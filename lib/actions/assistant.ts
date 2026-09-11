'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText } from '@/lib/ai'
import { buildSystemPrompt, getPersona } from '@/lib/assistantPersonas'
import {
    getLocalDateStr,
    getLocalMonthYearStr,
    getLocalDayOfWeek,
    addDaysToDateStr,
    formatLocalDate
} from '@/lib/utils'

// ============================================================
// PERFIL PERSONAL DEL COPILOTO ("quién soy")
// ============================================================

export interface AssistantContextProfile {
    about_me: string
    work: string
    relationships: string
    identity_statement: string
    current_focus: string
    struggles: string
    boundaries: string
    tone_preference: string
}

export async function getAssistantContextProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('assistant_context')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function saveAssistantContextProfile(form: Partial<AssistantContextProfile>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('assistant_context')
        .upsert({
            user_id: user.id,
            about_me: form.about_me || '',
            work: form.work || '',
            relationships: form.relationships || '',
            identity_statement: form.identity_statement || '',
            current_focus: form.current_focus || '',
            struggles: form.struggles || '',
            boundaries: form.boundaries || '',
            tone_preference: form.tone_preference || 'directo'
        }, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/asistente')
    return data
}

// ============================================================
// SNAPSHOT DEL SEGUNDO CEREBRO
// Arma un digest en markdown con todo lo que el asistente necesita saber.
// ============================================================

function trim(text: string | null | undefined, max = 240): string {
    if (!text) return ''
    const clean = String(text).replace(/\s+/g, ' ').trim()
    return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function money(n: number): string {
    return `$${Math.round(n).toLocaleString('es-AR')}`
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' }
const MOOD_LABEL: Record<number, string> = {
    1: 'muy mal', 2: 'mal', 3: 'neutro', 4: 'bien', 5: 'muy bien'
}
const DAY_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function buildBrainSnapshot(): Promise<string> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const now = new Date()
    const today = getLocalDateStr(now)
    const monthYear = getLocalMonthYearStr(now)
    const dow = getLocalDayOfWeek(now)
    const isoDay = dow === 0 ? 7 : dow
    const sevenDaysAgo = addDaysToDateStr(today, -7)
    const fourteenDaysAgo = addDaysToDateStr(today, -14)
    const thirtyDaysAgo = addDaysToDateStr(today, -30)
    const weekStart = addDaysToDateStr(today, isoDay === 7 ? -6 : 1 - isoDay)

    const uid = user.id
    const q = (table: string) => supabase.from(table).select('*').eq('user_id', uid)

    const [
        ctxRes, tasksRes, doneTasksRes, habitsRes, habitLogsRes,
        financesRes, debtsRes, goalsRes, envelopesRes,
        objectivesRes, dreamsRes, eventsRes,
        journalRes, notesRes, winsRes, ritualRes,
        nutProfileRes, nutProgressRes,
        trainPlanRes, trainLogsRes,
        commitmentsRes, weeklyPlanRes,
        mediaRes, wishlistRes, childRes
    ] = await Promise.all([
        q('assistant_context').maybeSingle(),
        q('tasks').in('status', ['Todo', 'InProgress']).order('priority', { ascending: true }).limit(40),
        q('tasks').eq('status', 'Done').gte('updated_at', `${sevenDaysAgo}T00:00:00-03:00`).limit(30),
        q('habits').eq('is_active', true),
        q('habit_logs').gte('completed_at', `${fourteenDaysAgo}T00:00:00-03:00`),
        q('finances').eq('month_year', monthYear),
        q('debts'),
        q('financial_goals'),
        q('budget_envelopes').eq('month_year', monthYear),
        q('objectives').eq('status', 'Active'),
        q('dreams').neq('status', 'Achieved').limit(10),
        q('events').gte('event_date', today).lte('event_date', addDaysToDateStr(today, 14)).order('event_date', { ascending: true }).limit(15),
        q('journal_entries').gte('date', thirtyDaysAgo).order('date', { ascending: false }).limit(8),
        q('mental_notes').eq('is_processed', false).order('created_at', { ascending: false }).limit(15),
        q('daily_wins').gte('date', fourteenDaysAgo).order('date', { ascending: false }).limit(10),
        q('morning_ritual_logs').gte('date', sevenDaysAgo).order('date', { ascending: false }).limit(7),
        q('nutrition_profiles').maybeSingle(),
        q('nutrition_progress').order('date', { ascending: false }).limit(8),
        q('training_plans').eq('status', 'active').order('start_date', { ascending: false }).limit(1).maybeSingle(),
        q('training_logs').gte('date', fourteenDaysAgo).order('date', { ascending: false }).limit(20),
        q('daily_commitments').gte('date', fourteenDaysAgo).order('date', { ascending: false }).limit(14),
        q('weekly_plans').eq('week_start_date', weekStart).maybeSingle(),
        q('media_backlog').eq('status', 'Active').limit(8),
        q('wishlist').eq('purchased', false).order('desire_level', { ascending: false }).limit(8),
        q('child_registry').order('created_at', { ascending: false }).limit(5)
    ])

    const ctx = ctxRes.data
    const tasks = tasksRes.data || []
    const doneTasks = doneTasksRes.data || []
    const habits = habitsRes.data || []
    const habitLogs = habitLogsRes.data || []
    const finances = financesRes.data || []
    const debts = debtsRes.data || []
    const goals = goalsRes.data || []
    const envelopes = envelopesRes.data || []
    const objectives = objectivesRes.data || []
    const dreams = dreamsRes.data || []
    const events = eventsRes.data || []
    const journal = journalRes.data || []
    const notes = notesRes.data || []
    const wins = winsRes.data || []
    const rituals = ritualRes.data || []
    const nutProfile = nutProfileRes.data
    const nutProgress = nutProgressRes.data || []
    const trainPlan = trainPlanRes.data
    const trainLogs = trainLogsRes.data || []
    const commitments = commitmentsRes.data || []
    const weeklyPlan = weeklyPlanRes.data
    const media = mediaRes.data || []
    const wishlist = wishlistRes.data || []
    const child = childRes.data || []

    const L: string[] = []

    // ---------- Quién es ----------
    L.push(`## QUIÉN ES EL USUARIO`)
    if (ctx?.about_me) L.push(`- Sobre él/ella: ${trim(ctx.about_me, 600)}`)
    if (ctx?.work) L.push(`- Trabajo: ${trim(ctx.work, 500)}`)
    if (ctx?.relationships) L.push(`- Vínculos: ${trim(ctx.relationships, 400)}`)
    if (ctx?.identity_statement) L.push(`- La persona que QUIERE ser: ${trim(ctx.identity_statement, 500)}`)
    if (ctx?.current_focus) L.push(`- Foco actual: ${trim(ctx.current_focus, 400)}`)
    if (ctx?.struggles) L.push(`- Lo que le cuesta / patrones que repite: ${trim(ctx.struggles, 500)}`)
    if (ctx?.boundaries) L.push(`- TEMAS QUE NO QUIERE QUE TOQUES (respetar sí o sí): ${trim(ctx.boundaries, 300)}`)
    if (!ctx) L.push(`- (Todavía no completó su perfil personal. Si hace falta, invitalo a llenarlo en la pestaña "Sobre mí".)`)

    // ---------- Hoy ----------
    L.push(`\n## HOY — ${formatLocalDate(now)} (${today})`)
    const todayCommitment = commitments.find((c: any) => c.date === today)
    if (todayCommitment) {
        L.push(`- COMPROMISO DE HOY: "${todayCommitment.action}"${todayCommitment.scheduled_time ? ` a las ${String(todayCommitment.scheduled_time).slice(0, 5)}` : ''}${todayCommitment.location ? ` en ${todayCommitment.location}` : ''} — estado: ${todayCommitment.status}`)
        if (todayCommitment.two_minute_version) L.push(`  - Versión de 2 minutos: ${todayCommitment.two_minute_version}`)
        if (todayCommitment.if_then_plan) L.push(`  - Plan si-entonces: ${todayCommitment.if_then_plan}`)
    } else {
        L.push(`- No firmó compromiso para hoy.`)
    }

    const todayRitual = rituals.find((r: any) => r.date === today)
    if (todayRitual?.daily_objective) L.push(`- Objetivo del ritual matutino: ${trim(todayRitual.daily_objective)}`)

    const todayEvents = events.filter((e: any) => e.event_date === today)
    if (todayEvents.length) {
        L.push(`- Eventos de hoy: ${todayEvents.map((e: any) => `${e.title}${e.start_time ? ` (${String(e.start_time).slice(0, 5)})` : ''}`).join(' | ')}`)
    }

    const todayTasks = tasks.filter((t: any) => t.planned_date === today || (!t.planned_date && t.due_date && t.due_date <= today))
    L.push(`- Tareas para hoy (${todayTasks.length}): ${todayTasks.slice(0, 10).map((t: any) => `${t.title} [${PRIORITY_LABEL[t.priority] || '—'}]`).join(' | ') || 'ninguna'}`)

    // ---------- Tareas ----------
    const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today)
    L.push(`\n## TAREAS`)
    L.push(`- Pendientes totales: ${tasks.length} | Vencidas: ${overdue.length} | Completadas en los últimos 7 días: ${doneTasks.length}`)
    if (overdue.length) {
        L.push(`- Vencidas: ${overdue.slice(0, 8).map((t: any) => `"${t.title}" (venció ${t.due_date})`).join(' | ')}`)
    }
    const highPriority = tasks.filter((t: any) => t.priority === 1)
    if (highPriority.length) {
        L.push(`- Prioridad alta abiertas: ${highPriority.slice(0, 8).map((t: any) => `"${t.title}"`).join(' | ')}`)
    }
    if (doneTasks.length) {
        L.push(`- Cerró recientemente: ${doneTasks.slice(0, 8).map((t: any) => `"${t.title}"`).join(' | ')}`)
    }

    // ---------- Hábitos ----------
    L.push(`\n## HÁBITOS (últimos 14 días)`)
    if (!habits.length) {
        L.push(`- No tiene hábitos activos cargados.`)
    } else {
        for (const h of habits) {
            const logs = habitLogs.filter((l: any) => l.habit_id === h.id)
            const days = new Set(logs.map((l: any) => getLocalDateStr(new Date(l.completed_at))))
            // Racha actual hacia atrás desde hoy
            let streak = 0
            for (let i = 0; i < 60; i++) {
                const d = addDaysToDateStr(today, -i)
                if (days.has(d)) streak++
                else if (i > 0) break
            }
            const doneToday = days.has(today)
            L.push(`- "${h.title}" (${h.time_of_day || 'anytime'}, ${h.estimated_minutes || 15} min): ${days.size}/14 días · racha ${streak} · hoy ${doneToday ? 'HECHO' : 'PENDIENTE'}`)
        }
    }

    // ---------- Finanzas ----------
    const income = finances.filter((f: any) => f.type === 'Income').reduce((s: number, f: any) => s + Number(f.amount), 0)
    const expense = finances.filter((f: any) => f.type !== 'Income').reduce((s: number, f: any) => s + Number(f.amount), 0)
    L.push(`\n## FINANZAS (mes ${monthYear}, en pesos argentinos)`)
    L.push(`- Ingresos: ${money(income)} | Gastos: ${money(expense)} | Balance: ${money(income - expense)}`)

    const byCategory = new Map<string, number>()
    for (const f of finances) {
        if (f.type === 'Income') continue
        const cat = f.budget_category || f.category || 'Otros'
        byCategory.set(cat, (byCategory.get(cat) || 0) + Number(f.amount))
    }
    if (byCategory.size) {
        const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        L.push(`- Gastos por categoría: ${top.map(([c, v]) => `${c} ${money(v)}`).join(' | ')}`)
    }
    const biggest = finances.filter((f: any) => f.type !== 'Income').sort((a: any, b: any) => Number(b.amount) - Number(a.amount)).slice(0, 5)
    if (biggest.length) {
        L.push(`- Gastos más grandes del mes: ${biggest.map((f: any) => `${f.description} ${money(Number(f.amount))}`).join(' | ')}`)
    }
    if (debts.length) {
        const totalDebt = debts.reduce((s: number, d: any) => s + Number(d.remaining_amount), 0)
        L.push(`- Deudas: total pendiente ${money(totalDebt)} → ${debts.map((d: any) => `${d.creditor} ${money(Number(d.remaining_amount))}${d.interest_rate ? ` (${d.interest_rate}%)` : ''}`).join(' | ')}`)
    }
    if (goals.length) {
        L.push(`- Metas financieras: ${goals.map((g: any) => `${g.title} ${money(Number(g.current_amount))}/${money(Number(g.target_amount))}`).join(' | ')}`)
    }
    if (envelopes.length) {
        const over = envelopes.filter((e: any) => Number(e.spent_amount) > Number(e.allocated_amount))
        if (over.length) L.push(`- Sobres PASADOS de presupuesto: ${over.map((e: any) => `${e.category} (${money(Number(e.spent_amount))} de ${money(Number(e.allocated_amount))})`).join(' | ')}`)
    }

    // ---------- Objetivos ----------
    if (objectives.length || dreams.length) {
        L.push(`\n## OBJETIVOS Y SUEÑOS`)
        for (const o of objectives.slice(0, 10)) {
            L.push(`- [${o.timeframe}/${o.type}] ${o.title} — ${o.progress_pct ?? 0}%${o.target_date ? ` (meta ${o.target_date})` : ''}`)
        }
        if (dreams.length) {
            L.push(`- Sueños pendientes: ${dreams.map((d: any) => `${d.title} (${d.category})`).join(' | ')}`)
        }
    }

    // ---------- Nutrición ----------
    if (nutProfile) {
        L.push(`\n## NUTRICIÓN`)
        L.push(`- ${nutProfile.weight_kg}kg, ${nutProfile.height_cm}cm, ${nutProfile.age} años · objetivo: ${nutProfile.goal}`)
        L.push(`- Meta diaria: ${nutProfile.target_calories} kcal · ${nutProfile.target_protein_g}g proteína · ${nutProfile.water_liters}L agua`)
        if (nutProfile.custom_notes) L.push(`- Notas de su vida/horarios: ${trim(nutProfile.custom_notes, 400)}`)
        if (nutProfile.disliked_ingredients?.length) L.push(`- No le gusta: ${nutProfile.disliked_ingredients.join(', ')}`)
        if (nutProgress.length >= 2) {
            const last = nutProgress[0]
            const first = nutProgress[nutProgress.length - 1]
            const delta = Number(last.weight_kg) - Number(first.weight_kg)
            L.push(`- Peso: ${first.weight_kg}kg (${first.date}) → ${last.weight_kg}kg (${last.date}) = ${delta > 0 ? '+' : ''}${delta.toFixed(1)}kg`)
        } else if (nutProgress.length === 1) {
            L.push(`- Último registro de peso: ${nutProgress[0].weight_kg}kg (${nutProgress[0].date})`)
        }
    }

    // ---------- Entrenamiento ----------
    if (trainPlan) {
        const weeks = trainPlan.plan_data?.weeks || []
        const daysSinceStart = Math.floor(
            (new Date(`${today}T12:00:00`).getTime() - new Date(`${trainPlan.start_date}T12:00:00`).getTime()) / 86400000
        )
        const currentWeek = Math.min(Math.max(Math.floor(daysSinceStart / 7) + 1, 1), weeks.length || 12)
        const week = weeks.find((w: any) => w.week === currentWeek)
        L.push(`\n## ENTRENAMIENTO`)
        L.push(`- Plan activo: "${trainPlan.name}" (${trainPlan.start_date} → ${trainPlan.end_date}) · semana ${currentWeek} de ${weeks.length || 12}`)
        if (week) {
            L.push(`- Semana actual: bloque "${week.block}", foco "${week.focus}"${week.deload ? ' — SEMANA DE DESCARGA' : ''}`)
            L.push(`- Sesiones de la semana: ${(week.days || []).map((d: any) => `${DAY_LABEL[d.day_iso % 7]}: ${d.title}`).join(' | ')}`)
            if (week.rope) L.push(`- Soga esta semana: ${week.rope.prescription}`)
        }
        const done2w = trainLogs.filter((l: any) => l.completed).length
        L.push(`- Sesiones completadas en los últimos 14 días: ${done2w}`)
        if (trainLogs.length) {
            const avgRpe = trainLogs.filter((l: any) => l.rpe).reduce((s: number, l: any) => s + l.rpe, 0) / (trainLogs.filter((l: any) => l.rpe).length || 1)
            if (avgRpe) L.push(`- Esfuerzo percibido promedio (RPE): ${avgRpe.toFixed(1)}/10`)
        }
    }

    // ---------- Journal y estado emocional ----------
    if (journal.length) {
        L.push(`\n## JOURNAL RECIENTE`)
        for (const j of journal.slice(0, 5)) {
            L.push(`- ${j.date}${j.mood ? ` (ánimo: ${MOOD_LABEL[j.mood] || j.mood}/5)` : ''}: ${trim(j.content, 300)}`)
        }
        const moods = journal.filter((j: any) => j.mood).map((j: any) => j.mood)
        if (moods.length >= 3) {
            const avg = moods.reduce((s: number, m: number) => s + m, 0) / moods.length
            L.push(`- Ánimo promedio últimas ${moods.length} entradas: ${avg.toFixed(1)}/5`)
        }
    }

    // ---------- Compromisos: adherencia ----------
    if (commitments.length) {
        const done = commitments.filter((c: any) => c.status === 'done').length
        const partial = commitments.filter((c: any) => c.status === 'partial').length
        const skipped = commitments.filter((c: any) => c.status === 'skipped').length
        L.push(`\n## ADHERENCIA A COMPROMISOS (últimos 14 días)`)
        L.push(`- Cumplidos: ${done} | Parciales: ${partial} | Salteados: ${skipped} | Firmados: ${commitments.length}`)
        const failed = commitments.filter((c: any) => c.status === 'skipped' && c.reflection)
        if (failed.length) {
            L.push(`- Motivos de los que no cumplió: ${failed.slice(0, 4).map((c: any) => `"${c.action}" → ${trim(c.reflection, 120)}`).join(' | ')}`)
        }
    }

    // ---------- Últimos ingresos al Segundo Cerebro ----------
    L.push(`\n## ÚLTIMOS INGRESOS AL SEGUNDO CEREBRO`)
    if (notes.length) {
        L.push(`- Vaciado mental sin procesar (${notes.length}): ${notes.slice(0, 10).map((n: any) => `"${trim(n.content, 140)}"`).join(' | ')}`)
    }
    if (wins.length) {
        L.push(`- Victorias diarias: ${wins.slice(0, 6).map((w: any) => `${w.date}: ${trim(w.win, 100)}`).join(' | ')}`)
    }
    if (weeklyPlan?.weekly_goals) L.push(`- Metas de esta semana: ${trim(weeklyPlan.weekly_goals, 300)}`)
    if (weeklyPlan?.reflection) L.push(`- Reflexión de la semana: ${trim(weeklyPlan.reflection, 300)}`)

    // ---------- Contexto liviano ----------
    const extras: string[] = []
    if (media.length) extras.push(`Consumiendo: ${media.map((m: any) => `${m.title} (${m.type}${m.progress ? `, ${m.progress}` : ''})`).join(', ')}`)
    if (wishlist.length) extras.push(`Wishlist: ${wishlist.map((w: any) => `${w.name}${w.price ? ` ${money(Number(w.price))}` : ''} (deseo ${w.desire_level}/5)`).join(', ')}`)
    if (child.length) extras.push(`Registro de Julián (hijo), últimas entradas: ${child.map((c: any) => `${c.category}: ${c.title}`).join(', ')}`)
    if (events.length > todayEvents.length) {
        extras.push(`Próximos eventos: ${events.filter((e: any) => e.event_date > today).slice(0, 6).map((e: any) => `${e.event_date} ${e.title}`).join(', ')}`)
    }
    if (extras.length) {
        L.push(`\n## OTROS DATOS`)
        extras.forEach(e => L.push(`- ${e}`))
    }

    return L.join('\n')
}

/** Versión legible del snapshot para mostrarle al usuario qué está viendo el asistente. */
export async function previewBrainSnapshot() {
    return buildBrainSnapshot()
}

// ============================================================
// SESIONES DE CHAT
// ============================================================

export async function listAssistantSessions() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('assistant_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(50)

    if (error) throw error
    return data || []
}

export async function getSessionMessages(sessionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createAssistantSession(persona: string, title?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('assistant_sessions')
        .insert({
            user_id: user.id,
            persona,
            title: title || `${getPersona(persona).label} · ${formatLocalDate(new Date(), 'd MMM')}`
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/asistente')
    return data
}

export async function deleteAssistantSession(sessionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('assistant_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/asistente')
}

export async function renameAssistantSession(sessionId: string, title: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('assistant_sessions')
        .update({ title: title.slice(0, 80) })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/asistente')
}

export async function switchSessionPersona(sessionId: string, persona: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('assistant_sessions')
        .update({ persona })
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) throw error
}

// ============================================================
// CHAT
// ============================================================

/**
 * Manda un mensaje al copiloto y devuelve la respuesta.
 * Si no hay sessionId, crea una sesión nueva y la devuelve.
 */
export async function sendAssistantMessage(params: {
    sessionId?: string | null
    persona: string
    message: string
}): Promise<{ reply: string; sessionId: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const text = params.message.trim()
    if (!text) throw new Error('El mensaje está vacío')

    let sessionId: string = params.sessionId || ''
    if (!sessionId) {
        const session = await createAssistantSession(params.persona, text.slice(0, 60))
        sessionId = session.id
    }

    await supabase.from('assistant_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        content: text,
        persona: params.persona
    })

    const [snapshot, history, ctxProfile] = await Promise.all([
        buildBrainSnapshot(),
        getSessionMessages(sessionId),
        getAssistantContextProfile().catch(() => null)
    ])

    const system = buildSystemPrompt(params.persona, ctxProfile?.tone_preference)

    const recent = history.slice(-16)
    const conversation = recent
        .map((m: any) => `${m.role === 'user' ? 'USUARIO' : 'VOS'}: ${m.content}`)
        .join('\n\n')

    const prompt = `
Este es el estado actual del Segundo Cerebro del usuario. Es información real y actualizada: usala para responder con datos concretos.

<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Conversación hasta ahora:
${conversation}

Respondé al último mensaje del usuario desde tu rol. No repitas el contexto textualmente: usalo.
`.trim()

    let reply: string
    try {
        reply = await generateText(prompt, { system, temperature: 0.8, maxOutputTokens: 1200 })
    } catch (e: any) {
        reply = `Uf, no me pude conectar con el modelo ahora mismo (${e?.message || 'error desconocido'}). Probá de nuevo en unos segundos.`
    }

    await supabase.from('assistant_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: reply,
        persona: params.persona
    })

    await supabase
        .from('assistant_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId)

    revalidatePath('/asistente')
    return { reply, sessionId }
}

/**
 * Briefing proactivo: qué le diría el asistente hoy sin que pregunte nada.
 * Se usa en el dashboard y al abrir el chat flotante.
 */
export async function getDailyBriefing(persona: string = 'estratega'): Promise<string> {
    const [snapshot, ctxProfile] = await Promise.all([
        buildBrainSnapshot(),
        getAssistantContextProfile().catch(() => null)
    ])

    const system = buildSystemPrompt(persona, ctxProfile?.tone_preference)

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Sin que el usuario te pregunte nada, dale su briefing de hoy en máximo 120 palabras:
1. Una observación real y específica sobre cómo viene (sacada de los datos, no genérica).
2. Lo único que más conviene que haga hoy.
3. Una alerta si ves algo que se está yendo de control (plata, tareas vencidas, un hábito que se cayó, ánimo bajo sostenido).

Escribilo corrido, en 3 o 4 frases. Nada de títulos ni listas.
`.trim()

    try {
        return await generateText(prompt, { system, temperature: 0.7, maxOutputTokens: 500 })
    } catch {
        return 'No pude generar el briefing ahora. Revisá las API keys o reintentá en unos segundos.'
    }
}

/** Crea una tarea directo desde una sugerencia del asistente. */
export async function createTaskFromAssistant(title: string, plannedDate?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: title.slice(0, 200),
            status: 'Todo',
            priority: 2,
            category: 'Personal',
            planned_date: plannedDate || getLocalDateStr()
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/tasks')
    revalidatePath('/')
    return data
}
