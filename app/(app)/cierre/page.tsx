import { getEveningRitual, getEveningRitualStats } from '@/lib/actions/evening_ritual'
import { getCommitment, getCommitmentStats } from '@/lib/actions/commitments'
import { getWeekStart, getWeeklyReview } from '@/lib/actions/weekly_review'
import { getLocalDateStr, addDaysToDateStr } from '@/lib/utils'
import { CierrePageClient } from './page.client'

export const dynamic = 'force-dynamic'

const EMPTY_COMMITMENT_STATS = { total: 0, done: 0, partial: 0, skipped: 0, successRate: 0, streak: 0 }
const EMPTY_RITUAL_STATS = { total: 0, streak: 0, avgRating: null, doneToday: false }

export default async function CierrePage({
    searchParams
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const { tab } = await searchParams
    const today = getLocalDateStr()
    const weekStart = await getWeekStart()

    const [ritual, ritualStats, commitment, tomorrow, commitmentStats, weeklyPlan] = await Promise.all([
        getEveningRitual(today).catch(() => null),
        getEveningRitualStats().catch(() => EMPTY_RITUAL_STATS),
        getCommitment(today).catch(() => null),
        getCommitment(addDaysToDateStr(today, 1)).catch(() => null),
        getCommitmentStats().catch(() => EMPTY_COMMITMENT_STATS),
        getWeeklyReview(weekStart).catch(() => null)
    ])

    return (
        <CierrePageClient
            ritual={ritual}
            commitment={commitment}
            tomorrow={tomorrow}
            commitmentStats={commitmentStats}
            ritualStats={ritualStats}
            weekStart={weekStart}
            weeklyPlan={weeklyPlan}
            initialTab={tab === 'semana' ? 'semana' : 'dia'}
        />
    )
}
