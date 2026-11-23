import { getRitualLog, getMorningData } from '@/lib/actions/morning_ritual'
import { getAppDay } from '@/lib/actions/day'
import { RitualClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function RitualPage() {
    const appDay = await getAppDay()
    const todayStr = appDay.date

    const [existingLog, morningData] = await Promise.all([
        getRitualLog(todayStr),
        getMorningData(todayStr)
    ])

    return (
        <RitualClient
            existingLog={existingLog}
            morningData={morningData}
            todayStr={todayStr}
        />
    )
}
