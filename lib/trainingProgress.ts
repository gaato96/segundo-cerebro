import { getLocalDateStr } from '@/lib/utils'

/**
 * Dónde estás parado realmente dentro del plan de 12 semanas.
 *
 * Antes la semana actual salía de una resta de fechas, así que el plan avanzaba
 * solo: si arrancaste hace tres semanas estabas en la semana 4 aunque no
 * hubieras hecho una sola sesión, y las semanas sin hacer quedaban atrás como
 * si las hubieras hecho.
 *
 * En modo 'adaptive' la semana actual es la primera que todavía tiene días sin
 * resolver. Un día se resuelve cuando lo hacés o cuando lo salteás a propósito;
 * saltear existe justamente para que una sesión que no vas a hacer nunca no te
 * deje trabado en esa semana para siempre.
 *
 * Este módulo es puro a propósito: lo usan la página de entrenamiento, el
 * snapshot del copiloto y el cron de notificaciones, y los tres tienen que
 * coincidir en qué semana estás.
 */

export type ProgressMode = 'adaptive' | 'calendar'

export interface ProgressWeek {
    week: number
    days: { index: number }[]
}

export interface ProgressLog {
    week_number: number
    day_index: number
    completed?: boolean | null
    skipped?: boolean | null
}

export interface ProgressPlan {
    start_date: string
    progress_mode?: string | null
    plan_data?: { weeks?: ProgressWeek[] } | null
}

export interface PlanProgress {
    mode: ProgressMode
    /** La semana en la que estás parado según el modo del plan. */
    currentWeek: number
    /** La semana que tocaría según las fechas, sin mirar lo que hiciste. */
    calendarWeek: number
    totalWeeks: number
    /** Cuántas semanas te separan del calendario. 0 si vas al día o adelantado. */
    weeksBehind: number
    /** Todos los días de las 12 semanas están resueltos. */
    finished: boolean
    /** Sesiones completadas por semana. */
    doneByWeek: Record<number, number>
    /** Sesiones resueltas (completadas + salteadas) por semana. */
    resolvedByWeek: Record<number, number>
}

export const DEFAULT_TOTAL_WEEKS = 12

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/** La semana que tocaría por fecha, que es lo único que se miraba antes. */
export function calendarWeekFor(startDate: string, today: string, totalWeeks: number): number {
    const diffDays = Math.floor(
        (new Date(`${today}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86400000
    )
    return clamp(Math.floor(diffDays / 7) + 1, 1, totalWeeks)
}

export function resolvePlanProgress(
    plan: ProgressPlan | null,
    logs: ProgressLog[] = [],
    today: string = getLocalDateStr()
): PlanProgress {
    const weeks = plan?.plan_data?.weeks || []
    const totalWeeks = weeks.length || DEFAULT_TOTAL_WEEKS
    const mode: ProgressMode = plan?.progress_mode === 'calendar' ? 'calendar' : 'adaptive'

    const doneByWeek: Record<number, number> = {}
    const resolvedByWeek: Record<number, number> = {}

    if (plan) {
        // Un día puede tener a lo sumo una fila (UNIQUE en la tabla), así que
        // contar filas no puede inflar el progreso.
        for (const log of logs) {
            const w = log.week_number
            if (log.completed) doneByWeek[w] = (doneByWeek[w] || 0) + 1
            if (log.completed || log.skipped) resolvedByWeek[w] = (resolvedByWeek[w] || 0) + 1
        }
    }

    const calendarWeek = plan ? calendarWeekFor(plan.start_date, today, totalWeeks) : 1

    let currentWeek = calendarWeek
    let finished = false

    if (plan && mode === 'adaptive') {
        const pending = [...weeks]
            .sort((a, b) => a.week - b.week)
            .find(w => (resolvedByWeek[w.week] || 0) < (w.days?.length || 0))

        if (pending) {
            currentWeek = pending.week
        } else if (weeks.length) {
            // Todo resuelto: el plan está terminado, la última semana es la que se muestra.
            currentWeek = totalWeeks
            finished = true
        }
    }

    return {
        mode,
        currentWeek: clamp(currentWeek, 1, totalWeeks),
        calendarWeek,
        totalWeeks,
        weeksBehind: Math.max(0, calendarWeek - currentWeek),
        finished,
        doneByWeek,
        resolvedByWeek
    }
}
