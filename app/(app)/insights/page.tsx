import { getInsights } from '@/lib/actions/insights'
import { InsightsPageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
    const data = await getInsights().catch(() => ({
        correlations: [],
        weeks: [],
        coverage: { days: 90, moodDays: 0, trainedDays: 0, commitmentDays: 0, eveningDays: 0, activeHabits: 0 }
    }))

    return (
        <InsightsPageClient
            correlations={data.correlations}
            weeks={data.weeks}
            coverage={data.coverage}
        />
    )
}
