import { getObjectives } from '@/lib/actions/okrs'
import { getDreams } from '@/lib/actions/dreams'
import { OKRsClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function OKRsPage() {
    const [okrData, dreams] = await Promise.all([
        getObjectives(),
        getDreams()
    ])

    return (
        <OKRsClient
            objectives={okrData.objectives}
            linkedTasks={okrData.linkedTasks}
            dreams={dreams}
        />
    )
}
