import {
    getTrainingProfile,
    getActiveTrainingPlan,
    getTrainingLogs
} from '@/lib/actions/training'
import { getParkLogs, getFootballMatches } from '@/lib/actions/park'
import { getProgressHistory, getNutritionProfile } from '@/lib/actions/nutrition'
import { resolvePlanProgress } from '@/lib/trainingProgress'
import { resolveParkProgress } from '@/lib/parkPlan'
import { getLocalDateStr, getWeekStartStr } from '@/lib/utils'
import { EntrenamientoPageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function EntrenamientoPage() {
    const [profile, plan, parkLogs, matches, weightLog, nutrition] = await Promise.all([
        getTrainingProfile().catch(() => null),
        getActiveTrainingPlan().catch(() => null),
        getParkLogs().catch(() => null),
        getFootballMatches().catch(() => null),
        getProgressHistory().catch(() => []),
        getNutritionProfile().catch(() => null)
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
            weights={(weightLog || []).filter((h: any) => Number(h.weight_kg) > 0).map((h: any) => ({ label: `${String(h.date).slice(8, 10)}/${String(h.date).slice(5, 7)}`, value: Number(h.weight_kg) }))}
            goalWeight={Number(nutrition?.target_weight_kg || nutrition?.goal_weight_kg) || null}
        />
    )
}
