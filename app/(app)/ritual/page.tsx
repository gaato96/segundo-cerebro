import { getRitualConfig, getRitualLog, getMorningData } from '@/lib/actions/morning_ritual'
import { RitualClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function RitualPage() {
    const todayStr = new Date().toISOString().split('T')[0]

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
