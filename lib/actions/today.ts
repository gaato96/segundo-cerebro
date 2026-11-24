'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAppDay } from '@/lib/actions/day'
import { syncRecurringTasks } from '@/lib/actions/tasks'
import { addDaysToDateStr, getLocalMonthYearStr, isHabitScheduledForDate, getLocalHour } from '@/lib/utils'

/**
 * Todo lo que necesita la pantalla "Hoy" en una sola ida a la base.
 * El ciclo del día (Capturar → Planificar → Hacer → Cerrar) se deduce de acá.
 */

export type CycleStep = 'capturar' | 'planificar' | 'hacer' | 'cerrar' | 'cerrado'

export async function getTodayData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const uid = user.id

    await syncRecurringTasks(uid)

    const appDay = await getAppDay()
    const today = appDay.date
    const weekAgo = addDaysToDateStr(today, -6)
    const monthYear = getLocalMonthYearStr()

    const [
        logRes, tasksRes, eventsRes, habitsRes, habitLogsRes, inboxRes, inboxCountRes,
        monthRes, todaySpendRes, bookRes, eveningRes, objectivesRes
    ] = await Promise.all([
        supabase.from('morning_ritual_logs').select('*').eq('user_id', uid).eq('date', today).maybeSingle(),
        supabase.from('tasks').select('*').eq('user_id', uid).in('status', ['Todo', 'InProgress', 'Done'])
            .or(`planned_date.eq.${today},and(planned_date.is.null,due_date.lte.${today})`)
            .order('priority', { ascending: true }).limit(40),
        supabase.from('events').select('*').eq('user_id', uid).eq('event_date', today).order('start_time', { ascending: true, nullsFirst: true }),
        supabase.from('habits').select('*').eq('user_id', uid).eq('is_active', true).order('time_of_day'),
        supabase.from('habit_logs').select('habit_id, completed_at').eq('user_id', uid).gte('completed_at', `${weekAgo}T00:00:00-03:00`),
        supabase.from('mental_notes').select('id, content, created_at').eq('user_id', uid).eq('is_processed', false).order('created_at', { ascending: false }).limit(2),
        supabase.from('mental_notes').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_processed', false),
        supabase.from('finances').select('type, amount').eq('user_id', uid).eq('month_year', monthYear),
        supabase.from('finances').select('amount').eq('user_id', uid).eq('type', 'Variable').eq('occurred_on', today),
        supabase.from('books').select('id, title, author, cover, current_page, page_count, progress_updated_at').eq('user_id', uid).eq('status', 'reading').order('progress_updated_at', { ascending: false }).limit(1),
        supabase.from('evening_ritual_logs').select('id').eq('user_id', uid).eq('date', today).maybeSingle(),
        supabase.from('objectives').select('id, title').eq('user_id', uid)
    ])

    const log = logRes.data
    const allTasks = (tasksRes.data || []) as any[]
    const objTitle = new Map((objectivesRes.data || []).map((o: any) => [o.id, o.title]))
    const withGoal = (t: any) => ({ ...t, objective_title: t.objective_id ? objTitle.get(t.objective_id) || null : null })

    // Las tareas del foco se traen aparte: pueden estar hechas o planificadas otro día.
    const focusIds: string[] = log?.mit_task_ids || []
    let focusTasks: any[] = []
    if (focusIds.length) {
        const { data } = await supabase.from('tasks').select('*').eq('user_id', uid).in('id', focusIds)
        const byId = new Map((data || []).map(t => [t.id, t]))
        focusTasks = focusIds.map(id => byId.get(id)).filter(Boolean).map(withGoal)
    }
    const focusSet = new Set(focusIds)
    const otherTasks = allTasks.filter(t => !focusSet.has(t.id) && t.status !== 'Done').map(withGoal)

    // Hábitos de hoy con los últimos 7 días (puntitos).
    const logs = (habitLogsRes.data || []) as { habit_id: string; completed_at: string }[]
    const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso))
    const days = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(today, i - 6))
    const habits = (habitsRes.data || [])
        .filter((h: any) => isHabitScheduledForDate(h, today))
        .map((h: any) => {
            const mine = logs.filter(l => l.habit_id === h.id).map(l => dayOf(l.completed_at))
            return {
                id: h.id,
                title: h.title,
                icon: h.icon,
                time_of_day: h.time_of_day,
                done_today: mine.includes(today),
                week: days.map(d => mine.includes(d))
            }
        })

    const month = (monthRes.data || []) as { type: string; amount: number }[]
    const income = month.filter(f => f.type === 'Income').reduce((s, f) => s + Number(f.amount), 0)
    const expenses = month.filter(f => f.type !== 'Income').reduce((s, f) => s + Number(f.amount), 0)
    const todaySpend = todaySpendRes.error ? null : (todaySpendRes.data || []).reduce((s: number, f: any) => s + Number(f.amount), 0)

    const planned = !!log?.completed_at && (!!log?.daily_objective || focusTasks.length > 0)
    const closed = !!eveningRes.data
    const hour = getLocalHour()
    const inboxCount = inboxCountRes.count ?? 0

    let cycle: CycleStep
    if (closed) cycle = 'cerrado'
    else if (!planned) cycle = inboxCount > 0 ? 'capturar' : 'planificar'
    else if (hour >= 20 || appDay.isAfterMidnight) cycle = 'cerrar'
    else cycle = 'hacer'

    return {
        today,
        appDay,
        cycle,
        planned,
        focus: log?.daily_objective || null,
        focusTasks,
        otherTasks,
        events: eventsRes.data || [],
        habits,
        inbox: { count: inboxCount, latest: inboxRes.data || [] },
        money: { todaySpend, balance: income - expenses, hasData: month.length > 0 },
        book: bookRes.data?.[0] || null
    }
}

export type TodayData = NonNullable<Awaited<ReturnType<typeof getTodayData>>>

/** Marca o desmarca un hábito en el día lógico. */
export async function toggleHabitToday(habitId: string, done: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }
    const { date } = await getAppDay()

    if (done) {
        const { error } = await supabase.from('habit_logs').insert({ habit_id: habitId, user_id: user.id })
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('habit_logs')
            .delete()
            .eq('habit_id', habitId)
            .eq('user_id', user.id)
            .gte('completed_at', `${date}T00:00:00-03:00`)
            .lt('completed_at', `${addDaysToDateStr(date, 1)}T00:00:00-03:00`)
        if (error) return { error: error.message }
    }
    revalidatePath('/habits')
    revalidatePath('/')
    return { success: true }
}
