import { getEveningRitual, getEveningRitualStats } from '@/lib/actions/evening_ritual'
import { getCommitment, getCommitmentStats } from '@/lib/actions/commitments'
import { getWeekStart, getWeeklyReview } from '@/lib/actions/weekly_review'
import { addDaysToDateStr } from '@/lib/utils'
import { getAppDay } from '@/lib/actions/day'
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
    // "Hoy" acá es el día lógico: si son las 01:30, el cierre sigue siendo
    // el del día anterior. Antes el sistema ya estaba en el día siguiente y
    // el cierre quedaba imposible de hacer.
    const appDay = await getAppDay()
    const today = appDay.date
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
            appDay={appDay}
        />
    )
}
