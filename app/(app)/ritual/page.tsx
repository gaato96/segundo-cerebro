import { getRitualConfig, getRitualLog, getMorningData } from '@/lib/actions/morning_ritual'
import { RitualClient } from './page.client'
import { getLocalDateStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function RitualPage() {
    const todayStr = getLocalDateStr()

    const [config, existingLog, morningData] = await Promise.all([
        getRitualConfig(),
        getRitualLog(todayStr),
        getMorningData(todayStr)
    ])

    return (
        <RitualClient
            config={config}
            existingLog={existingLog}
            morningData={morningData}
            todayStr={todayStr}
        />
    )
}
