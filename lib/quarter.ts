/**
 * Trimestres del año, sin base de datos ni IA.
 *
 * Q1 ene–mar · Q2 abr–jun · Q3 jul–sep · Q4 oct–dic.
 * Todas las fechas son strings YYYY-MM-DD en hora local de Argentina.
 */

import { getLocalDateStr } from '@/lib/utils'

export type QuarterLabel = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface QuarterInfo {
    year: number
    quarter: 1 | 2 | 3 | 4
    label: QuarterLabel
    /** "Q4 2026" */
    name: string
    start: string
    end: string
    totalDays: number
    /** Días que quedan contando hoy (0 si ya terminó). */
    daysLeft: number
    /** Porcentaje del trimestre que ya pasó (0–100). */
    elapsedPct: number
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Si al trimestre le quedan menos días que esto, se planifica el que viene. */
export const PLAN_NEXT_THRESHOLD_DAYS = 21

function pad(n: number) {
    return String(n).padStart(2, '0')
}

function daysBetween(a: string, b: string): number {
    const [y1, m1, d1] = a.split('-').map(Number)
    const [y2, m2, d2] = b.split('-').map(Number)
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export function quarterInfo(year: number, quarter: number, today: string = getLocalDateStr()): QuarterInfo {
    const q = Math.min(Math.max(Math.round(quarter), 1), 4) as 1 | 2 | 3 | 4
    const startMonth = (q - 1) * 3 + 1
    const endMonth = startMonth + 2
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
    const start = `${year}-${pad(startMonth)}-01`
    const end = `${year}-${pad(endMonth)}-${pad(lastDay)}`
    const totalDays = daysBetween(start, end) + 1

    let daysLeft: number
    if (today < start) daysLeft = totalDays
    else if (today > end) daysLeft = 0
    else daysLeft = daysBetween(today, end) + 1

    const elapsedPct = Math.round(((totalDays - daysLeft) / totalDays) * 100)

    return {
        year,
        quarter: q,
        label: `Q${q}` as QuarterLabel,
        name: `Q${q} ${year}`,
        start,
        end,
        totalDays,
        daysLeft,
        elapsedPct
    }
}

export function quarterOf(date: string = getLocalDateStr()): QuarterInfo {
    const [y, m] = date.split('-').map(Number)
    return quarterInfo(y, Math.floor((m - 1) / 3) + 1, date)
}

export function nextQuarter(q: { year: number; quarter: number }, today?: string): QuarterInfo {
    return q.quarter === 4 ? quarterInfo(q.year + 1, 1, today) : quarterInfo(q.year, q.quarter + 1, today)
}

/**
 * El trimestre que toca planificar hoy: el actual, salvo que esté por
 * terminar — ahí ya conviene armar el siguiente.
 */
export function planningQuarter(today: string = getLocalDateStr()): QuarterInfo {
    const current = quarterOf(today)
    return current.daysLeft < PLAN_NEXT_THRESHOLD_DAYS ? nextQuarter(current, today) : current
}

/** "1 de octubre" */
export function prettyDate(date: string): string {
    const [, m, d] = date.split('-').map(Number)
    return `${d} de ${MONTHS[m - 1]}`
}

export function daysSince(date: string | null | undefined, today: string = getLocalDateStr()): number | null {
    if (!date) return null
    return daysBetween(date.slice(0, 10), today)
}
