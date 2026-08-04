import { getTasks } from '@/lib/actions/tasks'
import { getEventsByDateRange } from '@/lib/actions/events'
import { getWeeklyPlan, getUnplannedTasks } from '@/lib/actions/weekly_plans'
import { PlannerClient } from './page.client'
import { getLocalDateStr, getLocalDayOfWeek, addDaysToDateStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PlannerPage() {
    const now = new Date()
    const dayOfWeek = getLocalDayOfWeek(now)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const dateStr = getLocalDateStr(now)
    const mondayStr = addDaysToDateStr(dateStr, diffToMonday)
    const sundayStr = addDaysToDateStr(dateStr, diffToMonday + 6)

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
            initialMondayStr={mondayStr}
        />
    )
}
