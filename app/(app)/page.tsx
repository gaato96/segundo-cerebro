import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DailySnapshot } from '@/components/dashboard/DailySnapshot'
import { PomodoroWidget } from '@/components/dashboard/PomodoroWidget'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

    // Fetch today's tasks (including overdue and no due date)
    const { data: todayTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'Done')
        .or(`due_date.lte.${todayStr},due_date.is.null`)
        .order('priority', { ascending: true })
        .limit(6)

    // Fetch habits
    const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)

    // Fetch today's habit logs
    const { data: todayLogs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .gte('completed_at', `${todayStr}T00:00:00-03:00`)
        .lte('completed_at', `${todayStr}T23:59:59-03:00`)

    // Fetch finances summary for current month
    const { data: finances } = await supabase
        .from('finances')
        .select('type, amount')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)

    const completedHabitIds = new Set((todayLogs || []).map((l: { habit_id: string }) => l.habit_id))

    const income = (finances || [])
        .filter((f: { type: string }) => f.type === 'Income')
        .reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const expenses = (finances || [])
        .filter((f: { type: string }) => f.type !== 'Income')
        .reduce((sum: number, f: { amount: number }) => sum + f.amount, 0)

    const todayFormatted = format(now, "EEEE d 'de' MMMM", { locale: es })

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text capitalize">
                        {todayFormatted}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Tu Daily Snapshot está listo
                    </p>
                </div>
            </div>

            {/* Quick Stats */}
            <QuickStats
                totalTasks={todayTasks?.length || 0}
                habitsDone={completedHabitIds.size}
                habitsTotal={habits?.length || 0}
                balance={income - expenses}
            />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Daily Snapshot */}
                <div className="lg:col-span-2 space-y-6">
                    <DailySnapshot
                        tasks={todayTasks || []}
                        habits={habits || []}
                        completedHabitIds={completedHabitIds}
                        userId={user.id}
                    />
                </div>

                {/* Right: Pomodoro */}
                <div>
                    <PomodoroWidget
                        tasks={todayTasks || []}
                        userId={user.id}
                    />
                </div>
            </div>
        </div>
    )
}
