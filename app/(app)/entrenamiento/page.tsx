import {
    getTrainingProfile,
    getActiveTrainingPlan,
    getTrainingLogs
} from '@/lib/actions/training'
import { resolvePlanProgress } from '@/lib/trainingProgress'
import { EntrenamientoPageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function EntrenamientoPage() {
    const [profile, plan] = await Promise.all([
        getTrainingProfile().catch(() => null),
        getActiveTrainingPlan().catch(() => null)
    ])

    const logs = plan ? await getTrainingLogs(plan.id).catch(() => []) : []
    const progress = resolvePlanProgress(plan, logs)

    return (
        <EntrenamientoPageClient
            profile={profile}
            plan={plan}
            logs={logs}
            progress={progress}
        />
    )
}
