import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DailySnapshot } from '@/components/dashboard/DailySnapshot'
import { PomodoroWidget } from '@/components/dashboard/PomodoroWidget'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { TodayEventsWidget } from '@/components/dashboard/TodayEventsWidget'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
// DailyWinWidget removed per user request
import { StickyNotesWidget } from '@/components/dashboard/StickyNotesWidget'
import { getStickyNotes } from '@/lib/actions/sticky_notes'
import { IdealRoutineWidget } from '@/components/dashboard/IdealRoutineWidget'
import { getEventsForDate } from '@/lib/actions/events'
import { getRitualLog } from '@/lib/actions/morning_ritual'
import Link from 'next/link'
import { Sun, Sparkles, CheckCircle2 } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    })
    const parts = formatter.formatToParts(now)
    const yr = parts.find(p => p.type === 'year')?.value
    const mo = parts.find(p => p.type === 'month')?.value
    const da = parts.find(p => p.type === 'day')?.value

    const todayStr = `${yr}-${mo}-${da}`
    const monthYear = `${yr}-${mo}`

    // Fetch profile, tasks, habits, events, ritual log in parallel
    const [profileRes, todayTasksRes, habitsRes, todayLogsRes, financesRes, todayEvents, ritualLog] = await Promise.all([
        supabase.from('profiles').select('ideal_routine_json').eq('id', user.id).single(),
        supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'Done').or(`due_date.lte.${todayStr},planned_date.eq.${todayStr},due_date.is.null`).order('priority', { ascending: true }).limit(6),
        supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).gte('completed_at', `${todayStr}T00:00:00-03:00`),
        supabase.from('finances').select('type, amount').eq('user_id', user.id).eq('month_year', monthYear),
        getEventsForDate(todayStr),
        getRitualLog(todayStr)
    ])

    const profile = profileRes.data
    const todayTasks = todayTasksRes.data || []
    const habits = habitsRes.data || []
    const todayLogs = todayLogsRes.data || []
    const finances = financesRes.data || []

    const completedHabitIds = new Set((todayLogs || []).map((l: { habit_id: string }) => l.habit_id))

    const income = finances.filter((f: { type: string }) => f.type === 'Income').reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)
    const expenses = finances.filter((f: { type: string }) => f.type !== 'Income').reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const todayFormatted = format(now, "EEEE d 'de' MMMM", { locale: es })
    const stickyNotes = await getStickyNotes()

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header & Morning Ritual Launcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text capitalize">
                        {todayFormatted}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Tu Resumen Diario y Centro de Control
                    </p>
                </div>

                <Link
                    href="/ritual"
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-lg transition-all ${
                        ritualLog
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
                    }`}
                >
                    <Sun className="w-4 h-4 text-amber-400" />
                    {ritualLog ? 'Ritual Matutino Completado ✓' : 'Iniciar Ritual Matutino →'}
                </Link>
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
