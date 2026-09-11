import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { sendPushToSubscriptions, isPushConfigured, type PushPayload } from '@/lib/push'
import { getLocalDateStr, getLocalDayOfWeek, addDaysToDateStr } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron de notificaciones.
 *
 * Se llama cada 15 minutos (ver vercel.json). En cada corrida mira la hora local
 * de Argentina y decide qué avisos vencieron dentro de la ventana.
 *
 * La deduplicación es la tabla notification_log con UNIQUE(user_id, kind, ref_date, ref_id):
 * insertamos PRIMERO y solo mandamos si la inserción ganó. Así dos corridas
 * superpuestas no mandan el mismo aviso dos veces.
 */

const TZ = 'America/Argentina/Buenos_Aires'

/** Minutos desde medianoche en hora local argentina. */
function localMinutesNow(): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date())
    const h = Number(parts.find(p => p.type === 'hour')?.value || 0)
    const m = Number(parts.find(p => p.type === 'minute')?.value || 0)
    return h * 60 + m
}

/** "HH:MM" o "HH:MM:SS" -> minutos desde medianoche. */
function timeToMinutes(time?: string | null): number | null {
    if (!time) return null
    const [h, m] = String(time).split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
}

/** ¿El horario objetivo cae dentro de esta corrida del cron? */
function isDue(target: string | null | undefined, now: number, windowMin: number): boolean {
    const t = timeToMinutes(target)
    if (t === null) return false
    return now >= t && now < t + windowMin
}

function hhmm(time?: string | null): string {
    return String(time || '').slice(0, 5)
}

export async function GET(req: NextRequest) {
    // --- Autenticación ---
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const isVercelCron = req.headers.get('x-vercel-cron') !== null

    if (!isVercelCron) {
        if (!secret) {
            return NextResponse.json(
                { error: 'CRON_SECRET no está configurado. Agregalo a las variables de entorno.' },
                { status: 500 }
            )
        }
        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
    }

    if (!hasAdminCredentials()) {
        return NextResponse.json(
            { error: 'Falta SUPABASE_SERVICE_ROLE_KEY: el cron no puede leer datos de los usuarios.' },
            { status: 500 }
        )
    }
    if (!isPushConfigured()) {
        return NextResponse.json({ error: 'Faltan las claves VAPID.' }, { status: 500 })
    }

    const windowMin = Math.min(Math.max(Number(req.nextUrl.searchParams.get('window') || 15), 1), 60)
    const dryRun = req.nextUrl.searchParams.get('dry') === '1'

    const supabase = createAdminClient()
    const now = localMinutesNow()
    const today = getLocalDateStr()
    const dow = getLocalDayOfWeek()
    const isoDay = dow === 0 ? 7 : dow
    const isSunday = dow === 0

    const { data: prefsList, error: prefsError } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('enabled', true)

    if (prefsError) {
        return NextResponse.json({ error: prefsError.message }, { status: 500 })
    }

    const report: any[] = []

    for (const prefs of prefsList || []) {
        const userId = prefs.user_id
        const due: { kind: string; refId: string; payload: PushPayload }[] = []

        // ---------- Datos del usuario ----------
        const q = (table: string) => supabase.from(table).select('*').eq('user_id', userId)

        const [commitRes, tasksRes, habitsRes, habitLogsRes, planRes, trainLogsRes, eveningRes] =
            await Promise.all([
                q('daily_commitments').eq('date', today).maybeSingle(),
                q('tasks').in('status', ['Todo', 'InProgress']),
                q('habits').eq('is_active', true),
                q('habit_logs').gte('completed_at', `${today}T00:00:00-03:00`),
                q('training_plans').eq('status', 'active').order('start_date', { ascending: false }).limit(1).maybeSingle(),
                q('training_logs').gte('date', addDaysToDateStr(today, -7)),
                q('evening_ritual_logs').eq('date', today).maybeSingle()
            ])

        const commitment = commitRes.data
        const openTasks = tasksRes.data || []
        const habits = habitsRes.data || []
        const habitLogs = habitLogsRes.data || []
        const plan = planRes.data
        const trainLogs = trainLogsRes.data || []
        const eveningDone = Boolean(eveningRes.data)

        const overdue = openTasks.filter((t: any) => t.due_date && t.due_date < today)
        const todayTasks = openTasks.filter((t: any) =>
            t.planned_date === today || (!t.planned_date && t.due_date && t.due_date <= today)
        )
        const doneHabitIds = new Set(habitLogs.map((l: any) => l.habit_id))
        const pendingHabits = habits.filter((h: any) => !doneHabitIds.has(h.id))

        // ¿Toca entrenar hoy y todavía no lo registró?
        let trainingToday: { title: string; weekNumber: number; dayIndex: number } | null = null
        if (plan) {
            const weeks = plan.plan_data?.weeks || []
            const diffDays = Math.floor(
                (new Date(`${today}T12:00:00`).getTime() - new Date(`${plan.start_date}T12:00:00`).getTime()) / 86400000
            )
            const weekNumber = Math.floor(diffDays / 7) + 1
            if (diffDays >= 0 && weekNumber >= 1 && weekNumber <= weeks.length) {
                const week = weeks.find((w: any) => w.week === weekNumber)
                const day = week?.days?.find((d: any) => d.day_iso === isoDay)
                if (day) {
                    const logged = trainLogs.some(
                        (l: any) => l.week_number === weekNumber && l.day_index === day.index && l.completed
                    )
                    if (!logged) trainingToday = { title: day.title, weekNumber, dayIndex: day.index }
                }
            }
        }

        // ---------- 1. Recordatorio del compromiso, a la hora exacta ----------
        if (prefs.commitment_reminder && commitment && commitment.status === 'pending') {
            if (isDue(commitment.scheduled_time, now, windowMin)) {
                due.push({
                    kind: 'commitment',
                    refId: commitment.id,
                    payload: {
                        title: 'Es la hora',
                        body: commitment.two_minute_version
                            ? `${commitment.action}\n\nSi no podés con todo: ${commitment.two_minute_version}`
                            : commitment.action,
                        url: '/',
                        tag: 'commitment',
                        requireInteraction: true
                    }
                })
            }
        }

        // ---------- 2. Briefing de la mañana ----------
        if (prefs.morning_briefing && isDue(prefs.morning_time, now, windowMin)) {
            const lines: string[] = []
            if (commitment) {
                lines.push(`Hoy: ${commitment.action}${commitment.scheduled_time ? ` (${hhmm(commitment.scheduled_time)})` : ''}`)
            } else {
                lines.push('No firmaste compromiso para hoy.')
            }
            if (todayTasks.length) lines.push(`${todayTasks.length} tarea${todayTasks.length > 1 ? 's' : ''} para hoy`)
            if (pendingHabits.length) lines.push(`${pendingHabits.length} hábito${pendingHabits.length > 1 ? 's' : ''} pendiente${pendingHabits.length > 1 ? 's' : ''}`)
            if (trainingToday) lines.push(`Entrenás: ${trainingToday.title}`)
            if (prefs.overdue_tasks && overdue.length) lines.push(`⚠ ${overdue.length} vencida${overdue.length > 1 ? 's' : ''}`)

            due.push({
                kind: 'morning',
                refId: '',
                payload: {
                    title: 'Tu día en una pantalla',
                    body: lines.join(' · '),
                    url: '/ritual',
                    tag: 'morning'
                }
            })
        }

        // ---------- 3. Entrenamiento que sigue sin hacerse ----------
        if (prefs.training_reminder && trainingToday && isDue('18:00', now, windowMin)) {
            due.push({
                kind: 'training',
                refId: `${trainingToday.weekNumber}-${trainingToday.dayIndex}`,
                payload: {
                    title: 'Todavía no entrenaste',
                    body: `${trainingToday.title}. Si no llegás con la sesión entera, hacé la entrada en calor y el primer ejercicio.`,
                    url: '/entrenamiento',
                    tag: 'training'
                }
            })
        }

        // ---------- 4. Ritual nocturno ----------
        if (prefs.evening_ritual && !eveningDone && isDue(prefs.evening_time, now, windowMin)) {
            const pending = commitment && commitment.status === 'pending'
            due.push({
                kind: 'evening',
                refId: '',
                payload: {
                    title: 'Cerrá el día',
                    body: pending
                        ? 'Te falta resolver el compromiso de hoy y firmar el de mañana. Son 3 minutos.'
                        : 'Anotá la victoria del día y firmá el compromiso de mañana. Son 3 minutos.',
                    url: '/cierre',
                    tag: 'evening',
                    requireInteraction: true
                }
            })
        }

        // ---------- 5. Revisión semanal (domingos) ----------
        if (prefs.weekly_review && isSunday && isDue(prefs.weekly_review_time, now, windowMin)) {
            due.push({
                kind: 'weekly_review',
                refId: '',
                payload: {
                    title: 'Revisión de la semana',
                    body: 'Diez minutos para ver qué funcionó, qué no, y qué hay que sacar del plan.',
                    url: '/cierre?tab=semana',
                    tag: 'weekly'
                }
            })
        }

        if (!due.length) continue

        // ---------- Envío ----------
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('id, endpoint, p256dh, auth')
            .eq('user_id', userId)

        if (!subs?.length) continue

        for (const item of due) {
            // Reservamos el aviso antes de mandarlo: si ya existe, otra corrida lo tomó.
            const { data: claimed } = await supabase
                .from('notification_log')
                .insert({
                    user_id: userId,
                    kind: item.kind,
                    ref_date: today,
                    ref_id: item.refId,
                    title: item.payload.title,
                    body: item.payload.body
                })
                .select('id')
                .maybeSingle()

            if (!claimed) continue          // duplicado, ya se mandó
            if (dryRun) {
                report.push({ userId, kind: item.kind, dryRun: true, body: item.payload.body })
                continue
            }

            const result = await sendPushToSubscriptions(subs, item.payload)

            if (result.expired.length) {
                await supabase.from('push_subscriptions').delete().in('endpoint', result.expired)
            }
            await supabase
                .from('notification_log')
                .update({ delivered: result.delivered })
                .eq('id', claimed.id)

            report.push({
                userId,
                kind: item.kind,
                delivered: result.delivered,
                expired: result.expired.length,
                errors: result.errors
            })
        }
    }

    return NextResponse.json({
        ok: true,
        localTime: `${String(Math.floor(now / 60)).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`,
        date: today,
        windowMin,
        dryRun,
        usersChecked: prefsList?.length || 0,
        sent: report
    })
}
