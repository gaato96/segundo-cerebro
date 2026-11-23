import { getRitualLog, getMorningData, getDayPlan } from '@/lib/actions/morning_ritual'
import { getAppDay } from '@/lib/actions/day'
import { RitualClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function RitualPage() {
    const appDay = await getAppDay()
    const todayStr = appDay.date

    const [existingLog, morningData, dayPlan] = await Promise.all([
        getRitualLog(todayStr),
        getMorningData(todayStr),
        getDayPlan(todayStr)
    ])

    return (
        <RitualClient
            existingLog={existingLog}
            morningData={morningData}
            planTasks={dayPlan.tasks}
            todayStr={todayStr}
        />
    )
}
