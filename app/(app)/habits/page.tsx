import { getHabitsWithStats } from '@/lib/actions/habits'
import { HabitsClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function HabitsPage() {
    const data = await getHabitsWithStats()

    return (
        <HabitsClient
            initialHabits={data.habits}
            initialLogs={data.logs}
            monthlyStats={data.monthlyStats}
        />
    )
}
