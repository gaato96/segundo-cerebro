import {
    getTrainingProfile,
    getActiveTrainingPlan,
    getTrainingLogs,
    getCurrentWeekNumber
} from '@/lib/actions/training'
import { EntrenamientoPageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function EntrenamientoPage() {
    const [profile, plan] = await Promise.all([
        getTrainingProfile().catch(() => null),
        getActiveTrainingPlan().catch(() => null)
    ])

    const [logs, currentWeek] = await Promise.all([
        plan ? getTrainingLogs(plan.id).catch(() => []) : Promise.resolve([]),
        getCurrentWeekNumber(plan)
    ])

    return (
        <EntrenamientoPageClient
            profile={profile}
            plan={plan}
            logs={logs}
            currentWeek={currentWeek}
        />
    )
}
