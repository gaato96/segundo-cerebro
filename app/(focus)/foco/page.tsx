import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDayPlan } from '@/lib/actions/morning_ritual'
import { getAppToday } from '@/lib/actions/day'
import { FocusMode } from '@/components/focus/FocusMode'

// Fuera del grupo (app): pantalla completa, sin menú ni barra. Solo la tarea.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Modo foco · Segundo Cerebro' }

export default async function FocoPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { task: taskParam } = await searchParams
    const today = await getAppToday()
    const plan = await getDayPlan(today)
    const queue = plan.tasks as any[]

    const taskId = taskParam || queue.find(t => t.status !== 'Done')?.id || null
    if (!taskId) {
        return <FocusMode task={null} subtasks={[]} queue={[]} objective={null} />
    }

    const [{ data: task }, { data: subtasks }] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id).eq('id', taskId).maybeSingle(),
        supabase.from('tasks').select('id, title, status').eq('user_id', user.id).eq('parent_task_id', taskId).order('created_at')
    ])

    let objective: string | null = null
    if (task?.objective_id) {
        const { data } = await supabase.from('objectives').select('title').eq('id', task.objective_id).maybeSingle()
        objective = data?.title || null
    }

    return (
        <FocusMode
            task={task}
            subtasks={subtasks || []}
            queue={queue.map(t => ({ id: t.id, title: t.title, status: t.status }))}
            objective={objective}
        />
    )
}
