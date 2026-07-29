import { getTasks } from '@/lib/actions/tasks'
import { getEventsByDateRange } from '@/lib/actions/events'
import { getWeeklyPlan, getUnplannedTasks } from '@/lib/actions/weekly_plans'
import { PlannerClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function PlannerPage() {
    // Calculate Monday of current week
    const now = new Date()
    const dayOfWeek = now.getDay()
    // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    const mondayStr = monday.toISOString().split('T')[0]

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const sundayStr = sunday.toISOString().split('T')[0]

    const [allTasks, unplannedTasks, events, weeklyPlan] = await Promise.all([
        getTasks(),
        getUnplannedTasks(),
        getEventsByDateRange(mondayStr, sundayStr),
        getWeeklyPlan(mondayStr)
    ])

    return (
        <PlannerClient
            initialTasks={allTasks || []}
            initialUnplanned={unplannedTasks || []}
            initialEvents={events || []}
            initialPlan={weeklyPlan}
            mondayStr={mondayStr}
        />
    )
}
