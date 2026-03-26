import { getHabits } from '@/lib/actions/habits'
import { HabitsClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function HabitsPage() {
    const data = await getHabits()

    return <HabitsClient habits={data.habits} logs={data.logs} />
}
