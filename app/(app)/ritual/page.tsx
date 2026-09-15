import { getRitualConfig, getRitualLog, getMorningData } from '@/lib/actions/morning_ritual'
import { getCommitment, getCommitmentStats } from '@/lib/actions/commitments'
import { getAppDay } from '@/lib/actions/day'
import { RitualClient } from './page.client'
import { addDaysToDateStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const EMPTY_COMMITMENT_STATS = { total: 0, done: 0, partial: 0, skipped: 0, successRate: 0, streak: 0 }

export default async function RitualPage() {
    const appDay = await getAppDay()
    const todayStr = appDay.date

    const [config, existingLog, morningData, commitment, tomorrowCommitment, commitmentStats] = await Promise.all([
        getRitualConfig(),
        getRitualLog(todayStr),
        getMorningData(todayStr),
        getCommitment(todayStr).catch(() => null),
        getCommitment(addDaysToDateStr(todayStr, 1)).catch(() => null),
        getCommitmentStats().catch(() => EMPTY_COMMITMENT_STATS)
    ])

    return (
        <RitualClient
            config={config}
            existingLog={existingLog}
            morningData={morningData}
            todayStr={todayStr}
            commitment={commitment}
            tomorrowCommitment={tomorrowCommitment}
            commitmentStats={commitmentStats}
            appDay={appDay}
        />
    )
}
