import { isHabitScheduledForDate } from '@/lib/utils'

/**
 * Recordatorios con hora de tareas y hábitos.
 *
 * Lo usan las dos vías de aviso, para que digan lo mismo:
 * - el vigilante de la app abierta en la PC (components/notifications/PcReminders)
 * - el cron de push (app/api/notifications/cron)
 */

export interface DueReminder {
    /** Único por ítem y hora: si cambiás la hora, vuelve a avisar. */
    key: string
    kind: 'task' | 'habit'
    id: string
    title: string
    /** "HH:MM" */
    time: string
    url: string
}

function hhmm(time?: string | null): string {
    return String(time || '').slice(0, 5)
}

/** ¿La tarea toca hoy? Fecha límite o planificada para hoy, o sin fecha. */
function taskIsForToday(task: any, today: string): boolean {
    const due = task.due_date ? String(task.due_date).slice(0, 10) : null
    const planned = task.planned_date ? String(task.planned_date).slice(0, 10) : null
    if (planned) return planned === today
    if (due) return due === today
    return true
}

export function buildTodayReminders(
    tasks: any[],
    habits: any[],
    doneHabitIds: Set<string>,
    today: string
): DueReminder[] {
    const list: DueReminder[] = []

    for (const t of tasks) {
        if (!t.reminder_time) continue
        if (t.status !== 'Todo' && t.status !== 'InProgress') continue
        // Las plantillas recurrentes no se avisan: se avisa la instancia del día.
        if (t.is_recurring && !t.recurring_parent_id) continue
        if (t.parent_task_id) continue
        if (!taskIsForToday(t, today)) continue
        const time = hhmm(t.reminder_time)
        list.push({ key: `task:${t.id}@${time}`, kind: 'task', id: t.id, title: t.title, time, url: '/tasks' })
    }

    for (const h of habits) {
        if (!h.reminder_time || h.is_active === false) continue
        if (doneHabitIds.has(h.id)) continue
        if (!isHabitScheduledForDate(h, today)) continue
        const time = hhmm(h.reminder_time)
        list.push({ key: `habit:${h.id}@${time}`, kind: 'habit', id: h.id, title: h.title, time, url: '/habits' })
    }

    return list.sort((a, b) => a.time.localeCompare(b.time))
}
