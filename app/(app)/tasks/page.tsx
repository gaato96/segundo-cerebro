import { getTasks, getRecurringTasks } from '@/lib/actions/tasks'
import { TasksClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const [initialTasks, initialRecurringTasks] = await Promise.all([
        getTasks().catch(() => []),
        getRecurringTasks().catch(() => [])
    ])

    return (
        <TasksClient
            initialTasks={initialTasks || []}
            initialRecurringTasks={initialRecurringTasks || []}
        />
    )
}
