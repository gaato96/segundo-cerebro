import { getObjectives } from '@/lib/actions/okrs'
import { OKRsClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function OKRsPage() {
    const data = await getObjectives()

    return <OKRsClient objectives={data.objectives} linkedTasks={data.linkedTasks} />
}
