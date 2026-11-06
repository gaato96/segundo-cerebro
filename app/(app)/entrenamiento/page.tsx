import {
    getTrainingProfile,
    getActiveTrainingPlan,
    getTrainingLogs
} from '@/lib/actions/training'
import { getParkLogs, getFootballMatches } from '@/lib/actions/park'
import { resolvePlanProgress } from '@/lib/trainingProgress'
import { resolveParkProgress } from '@/lib/parkPlan'
import { getLocalDateStr, getWeekStartStr } from '@/lib/utils'
import { EntrenamientoPageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function EntrenamientoPage() {
    const [profile, plan, parkLogs, matches] = await Promise.all([
        getTrainingProfile().catch(() => null),
        getActiveTrainingPlan().catch(() => null),
        getParkLogs().catch(() => null),
        getFootballMatches().catch(() => null)
    ])

    const logs = plan ? await getTrainingLogs(plan.id).catch(() => []) : []
    const progress = resolvePlanProgress(plan, logs)
    const parkProgress = resolveParkProgress(parkLogs || [])

    // Lo que moviste esta semana (lunes a hoy), sumando los tres frentes.
    const weekStart = getWeekStartStr(getLocalDateStr())
    const inWeek = (d?: string | null) => !!d && d >= weekStart
    const weekSummary = {
        strength: logs.filter((l: any) => l.completed && inWeek(l.date)).length,
        park: (parkLogs || []).filter((l: any) => l.completed && inWeek(l.date)).length,
        matches: (matches || []).filter((m: any) => inWeek(m.date)).length
    }

    return (
        <EntrenamientoPageClient
            profile={profile}
            plan={plan}
            logs={logs}
            progress={progress}
            parkLogs={parkLogs}
            parkProgress={parkProgress}
            matches={matches}
            weekSummary={weekSummary}
        />
    )
}
