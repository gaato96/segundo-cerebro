import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DailySnapshot } from '@/components/dashboard/DailySnapshot'
import { PomodoroWidget } from '@/components/dashboard/PomodoroWidget'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { TodayEventsWidget } from '@/components/dashboard/TodayEventsWidget'
import { StickyNotesWidget } from '@/components/dashboard/StickyNotesWidget'
import { getStickyNotes } from '@/lib/actions/sticky_notes'
import { IdealRoutineWidget } from '@/components/dashboard/IdealRoutineWidget'
import { getEventsForDate } from '@/lib/actions/events'
import { getRitualLog } from '@/lib/actions/morning_ritual'
import Link from 'next/link'
import { Sun } from 'lucide-react'
import { QuickTransactionModal } from '@/components/dashboard/QuickTransactionModal'
import { getLocalDateStr, getLocalMonthYearStr, getLocalDayOfWeek, formatLocalDate } from '@/lib/utils'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const now = new Date()
    const todayStr = getLocalDateStr(now)
    const monthYear = getLocalMonthYearStr(now)

    // Calculate today's ISO day of week (1 = Mon ... 7 = Sun)
    const dayOfWeek = getLocalDayOfWeek(now)
    const todayIsoDay = dayOfWeek === 0 ? 7 : dayOfWeek

    // Fetch profile, tasks, habits, events, ritual log in parallel
    const [profileRes, todayTasksRes, habitsRes, todayLogsRes, financesRes, todayEvents, ritualLog] = await Promise.all([
        supabase.from('profiles').select('ideal_routine_json').eq('id', user.id).single(),
        supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'Done').or(`planned_date.eq.${todayStr},and(planned_date.is.null,due_date.lte.${todayStr})`).order('priority', { ascending: true }).limit(8),
        supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).gte('completed_at', `${todayStr}T00:00:00-03:00`),
        supabase.from('finances').select('type, amount').eq('user_id', user.id).eq('month_year', monthYear),
        getEventsForDate(todayStr),
        getRitualLog(todayStr)
    ])

    const profile = profileRes.data
    const todayTasks = todayTasksRes.data || []
    const rawHabits = habitsRes.data || []
    const todayLogs = todayLogsRes.data || []
    const finances = financesRes.data || []

    // Filter habits strictly for today based on frequency_type & frequency_days
    const habits = rawHabits.filter((h: any) => {
        if (h.frequency_type === 'custom_days' && Array.isArray(h.frequency_days) && h.frequency_days.length > 0) {
            return h.frequency_days.includes(todayIsoDay)
        }
        return true // 'daily' or default
    })

    const completedHabitIds = new Set((todayLogs || []).map((l: { habit_id: string }) => l.habit_id))

    const income = finances.filter((f: { type: string }) => f.type === 'Income').reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)
    const expenses = finances.filter((f: { type: string }) => f.type !== 'Income').reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const todayFormatted = formatLocalDate(now)
    const stickyNotes = await getStickyNotes()

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header & Quick Action Launchers */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl md:text-3xl font-heading font-bold gradient-text capitalize leading-tight">
                        {todayFormatted}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Tu Resumen Diario y Centro de Control
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                    <QuickTransactionModal />

                    <Link
                        href="/ritual"
                        className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-lg transition-all whitespace-nowrap ${
                            ritualLog
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
                        }`}
                    >
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{ritualLog ? '✓ Ritual Completado' : 'Iniciar Ritual →'}</span>
                    </Link>
                </div>
            </div>

            <IdealRoutineWidget routine={profile?.ideal_routine_json || null} />

            <StickyNotesWidget initialNotes={stickyNotes} />

            {/* Quick Stats (4 cards) */}
            <QuickStats
                totalTasks={todayTasks.length}
                habitsDone={completedHabitIds.size}
                habitsTotal={habits.length}
                balance={income - expenses}
                eventsTodayCount={todayEvents.length}
            />

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Daily Snapshot & Events */}
                <div className="lg:col-span-2 space-y-6">
                    <DailySnapshot
                        tasks={todayTasks}
                        habits={habits}
                        completedHabitIds={completedHabitIds}
                        userId={user.id}
                    />
                    <TodayEventsWidget events={todayEvents} />
                </div>

                {/* Right: Pomodoro */}
                <div>
                    <PomodoroWidget
                        tasks={todayTasks}
                        userId={user.id}
                    />
                </div>
            </div>
        </div>
    )
}
