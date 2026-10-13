/**
 * Análisis del registro diario de gastos. Funciones puras: las usa la pantalla
 * de finanzas (cliente) y el analista de IA (servidor) con los mismos números.
 *
 * "Gasto del día a día" = movimientos variables no recurrentes. Los fijos
 * (alquiler, servicios) y los pagos de deuda se cuentan aparte: meterlos en el
 * promedio diario lo deforma el día que se pagan.
 */

export interface ExpenseRecord {
    id: string
    date: string            // YYYY-MM-DD (día en que se gastó)
    amount: number
    type: string            // Income | Fixed_Expense | Variable | Debt_Payment
    category: string
    description: string
    payment_method: string | null
    necessity: string | null
    is_recurring: boolean
}

export type RangeKind = '7d' | 'mes' | '30d' | 'mes_pasado' | '90d'

export const RANGE_LABELS: Record<RangeKind, string> = {
    '7d': 'Últimos 7 días',
    mes: 'Este mes',
    '30d': 'Últimos 30 días',
    mes_pasado: 'Mes pasado',
    '90d': 'Últimos 90 días'
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function isDailySpend(e: ExpenseRecord): boolean {
    return e.type === 'Variable' && !e.is_recurring
}

export function isSpending(e: ExpenseRecord): boolean {
    return e.type === 'Variable' || e.type === 'Fixed_Expense'
}

// ---------- Fechas como texto (sin zonas horarias de por medio) ----------

function toUTC(date: string): Date {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(d: Date): string {
    return d.toISOString().slice(0, 10)
}

export function shiftDate(date: string, days: number): string {
    const d = toUTC(date)
    d.setUTCDate(d.getUTCDate() + days)
    return fromUTC(d)
}

export function weekdayOf(date: string): number {
    return toUTC(date).getUTCDay()
}

export function daysBetween(from: string, to: string): number {
    return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86400000) + 1
}

export function daysInMonthOf(date: string): number {
    const [y, m] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function rangeFor(kind: RangeKind, today: string): { from: string; to: string } {
    const [y, m] = today.split('-').map(Number)
    switch (kind) {
        case '7d':
            return { from: shiftDate(today, -6), to: today }
        case '30d':
            return { from: shiftDate(today, -29), to: today }
        case '90d':
            return { from: shiftDate(today, -89), to: today }
        case 'mes_pasado': {
            const first = fromUTC(new Date(Date.UTC(y, m - 2, 1)))
            const last = fromUTC(new Date(Date.UTC(y, m - 1, 0)))
            return { from: first, to: last }
        }
        case 'mes':
        default:
            return { from: `${today.slice(0, 7)}-01`, to: today }
    }
}

/** El período inmediatamente anterior y del mismo largo, para comparar. */
export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
    const len = daysBetween(range.from, range.to)
    return { from: shiftDate(range.from, -len), to: shiftDate(range.from, -1) }
}

function median(values: number[]): number {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function normalizeKey(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[0-9$.,:;!¡?¿()\-_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// ---------- Resumen de un período ----------

export interface DayPoint { date: string; total: number; count: number }

export interface CategoryStat {
    category: string
    total: number
    count: number
    pct: number
    avgTicket: number
}

export interface HormigaStat {
    label: string
    category: string
    count: number
    total: number
    avgTicket: number
    monthly: number
    yearly: number
}

export interface SpendingSummary {
    from: string
    to: string
    days: number
    /** Todo lo gastado (variables + fijos), sin pagos de deuda. */
    total: number
    fixedTotal: number
    debtPayments: number
    /** Solo el día a día. */
    dailyTotal: number
    count: number
    avgPerDay: number
    medianDay: number
    typicalTicket: number
    noSpendDays: number
    maxDay: DayPoint | null
    series: DayPoint[]
    byCategory: CategoryStat[]
    byMethod: { method: string; total: number; count: number; pct: number }[]
    byNecessity: { necesario: number; gusto: number; impulso: number; sin_dato: number }
    byWeekday: { weekday: number; label: string; avg: number }[]
    hormiga: HormigaStat[]
    expensiveDays: { date: string; total: number; topItem: string }[]
}

export function summarize(records: ExpenseRecord[], from: string, to: string): SpendingSummary {
    const inRange = records.filter(r => r.date >= from && r.date <= to)
    const spending = inRange.filter(isSpending)
    const daily = inRange.filter(isDailySpend)
    const days = Math.max(daysBetween(from, to), 1)

    const total = spending.reduce((s, r) => s + r.amount, 0)
    const fixedTotal = inRange.filter(r => r.type === 'Fixed_Expense' || (r.type === 'Variable' && r.is_recurring))
        .reduce((s, r) => s + r.amount, 0)
    const debtPayments = inRange.filter(r => r.type === 'Debt_Payment').reduce((s, r) => s + r.amount, 0)
    const dailyTotal = daily.reduce((s, r) => s + r.amount, 0)

    // Serie día por día, incluidos los días sin gasto (también dicen algo).
    const byDate = new Map<string, DayPoint>()
    for (let i = 0; i < days; i++) {
        const date = shiftDate(from, i)
        byDate.set(date, { date, total: 0, count: 0 })
    }
    for (const r of daily) {
        const point = byDate.get(r.date)
        if (point) {
            point.total += r.amount
            point.count += 1
        }
    }
    const series = Array.from(byDate.values())
    const dayTotals = series.map(p => p.total)
    const maxDay = series.reduce<DayPoint | null>((best, p) => (p.total > (best?.total || 0) ? p : best), null)

    // Por categoría (todo el gasto, fijos incluidos: el alquiler también se optimiza).
    const catMap = new Map<string, { total: number; count: number }>()
    for (const r of spending) {
        const key = r.category || 'Otros'
        const cur = catMap.get(key) || { total: 0, count: 0 }
        cur.total += r.amount
        cur.count += 1
        catMap.set(key, cur)
    }
    const byCategory = Array.from(catMap.entries())
        .map(([category, v]) => ({
            category,
            total: v.total,
            count: v.count,
            pct: total > 0 ? (v.total / total) * 100 : 0,
            avgTicket: v.count ? v.total / v.count : 0
        }))
        .sort((a, b) => b.total - a.total)

    const methodMap = new Map<string, { total: number; count: number }>()
    for (const r of spending) {
        const key = r.payment_method || 'sin_dato'
        const cur = methodMap.get(key) || { total: 0, count: 0 }
        cur.total += r.amount
        cur.count += 1
        methodMap.set(key, cur)
    }
    const byMethod = Array.from(methodMap.entries())
        .map(([method, v]) => ({ method, total: v.total, count: v.count, pct: total > 0 ? (v.total / total) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)

    const byNecessity = { necesario: 0, gusto: 0, impulso: 0, sin_dato: 0 }
    for (const r of spending) {
        const key = (r.necessity && r.necessity in byNecessity ? r.necessity : 'sin_dato') as keyof typeof byNecessity
        byNecessity[key] += r.amount
    }

    // Promedio por día de la semana: total de ese día / cuántos hubo en el período.
    const wdTotals = Array(7).fill(0)
    const wdCounts = Array(7).fill(0)
    for (const p of series) {
        const wd = weekdayOf(p.date)
        wdTotals[wd] += p.total
        wdCounts[wd] += 1
    }
    const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(wd => ({
        weekday: wd,
        label: WEEKDAYS[wd],
        avg: wdCounts[wd] ? wdTotals[wd] / wdCounts[wd] : 0
    }))

    // Gastos hormiga: chiquitos y repetidos. Solos no duelen; sumados, sí.
    const tickets = daily.map(r => r.amount)
    const typicalTicket = median(tickets)
    const smallLimit = Math.max(typicalTicket * 1.5, 1)
    const groups = new Map<string, { label: string; category: string; total: number; count: number }>()
    for (const r of daily) {
        if (r.amount > smallLimit) continue
        const descKey = normalizeKey(r.description || '')
        const useDesc = descKey && descKey !== normalizeKey(r.category || '')
        const key = useDesc ? `d:${descKey}` : `c:${r.category}`
        const cur = groups.get(key) || {
            label: useDesc ? (r.description || '').trim() : r.category,
            category: r.category,
            total: 0,
            count: 0
        }
        cur.total += r.amount
        cur.count += 1
        groups.set(key, cur)
    }
    const hormiga = Array.from(groups.values())
        .filter(g => g.count >= 3)
        .map(g => ({
            ...g,
            avgTicket: g.total / g.count,
            monthly: (g.total / days) * 30,
            yearly: (g.total / days) * 365
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)

    const avgPerDay = dailyTotal / days
    const expensiveDays = series
        .filter(p => p.total > 0 && p.total >= avgPerDay * 1.8)
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)
        .map(p => {
            const top = daily
                .filter(r => r.date === p.date)
                .sort((a, b) => b.amount - a.amount)[0]
            return { date: p.date, total: p.total, topItem: top ? (top.description || top.category) : '' }
        })

    return {
        from,
        to,
        days,
        total,
        fixedTotal,
        debtPayments,
        dailyTotal,
        count: spending.length,
        avgPerDay,
        medianDay: median(dayTotals),
        typicalTicket,
        noSpendDays: series.filter(p => p.total === 0).length,
        maxDay,
        series,
        byCategory,
        byMethod,
        byNecessity,
        byWeekday,
        hormiga,
        expensiveDays
    }
}

export interface CategoryDelta {
    category: string
    current: number
    previous: number
    /** Diferencia llevada a 30 días, para comparar períodos de distinto largo. */
    deltaMonthly: number
    deltaPct: number | null
}

/** Qué categorías subieron o bajaron respecto del período anterior. */
export function compareCategories(current: SpendingSummary, previous: SpendingSummary): CategoryDelta[] {
    const prev = new Map(previous.byCategory.map(c => [c.category, c.total]))
    const names = new Set([...current.byCategory.map(c => c.category), ...previous.byCategory.map(c => c.category)])

    return Array.from(names)
        .map(category => {
            const cur = current.byCategory.find(c => c.category === category)?.total || 0
            const before = prev.get(category) || 0
            const curMonthly = (cur / current.days) * 30
            const prevMonthly = (before / Math.max(previous.days, 1)) * 30
            return {
                category,
                current: cur,
                previous: before,
                deltaMonthly: curMonthly - prevMonthly,
                deltaPct: prevMonthly > 0 ? ((curMonthly - prevMonthly) / prevMonthly) * 100 : null
            }
        })
        .sort((a, b) => b.deltaMonthly - a.deltaMonthly)
}
