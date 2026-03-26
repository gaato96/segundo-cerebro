import { getTasks } from '@/lib/actions/tasks'
import { TasksClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const initialTasks = await getTasks()

    return <TasksClient initialTasks={initialTasks || []} />
}
