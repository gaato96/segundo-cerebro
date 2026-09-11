'use server'

import { createClient } from '@/lib/supabase/server'
import { getLocalDateStr, getLocalMonthYearStr } from '@/lib/utils'

/**
 * Semáforo financiero: ¿llegás a fin de mes?
 *
 * Usa lo que ya está cargado: ingresos y gastos del mes, gastos fijos recurrentes
 * que todavía no se pagaron, y el ritmo de gasto variable de lo que va del mes.
 */

export type ForecastStatus = 'verde' | 'amarillo' | 'rojo'

export interface MonthForecast {
    monthYear: string
    daysElapsed: number
    daysRemaining: number
    daysInMonth: number
    income: number
    spent: number
    balanceToday: number
    /** Gastos fijos recurrentes cuyo día de vencimiento todavía no llegó. */
    upcomingFixed: number
    upcomingFixedItems: { description: string; amount: number; dueDay: number }[]
    /** Proyección del gasto variable que falta, al ritmo actual. */
    projectedVariable: number
    dailyVariableRate: number
    projectedEndBalance: number
    status: ForecastStatus
    headline: string
    detail: string
    safeDailySpend: number
}

function daysInMonth(monthYear: string): number {
    const [y, m] = monthYear.split('-').map(Number)
    return new Date(y, m, 0).getDate()
}

function money(n: number): string {
    return `$${Math.round(n).toLocaleString('es-AR')}`
}

export async function getMonthForecast(monthYear?: string): Promise<MonthForecast> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const month = monthYear || getLocalMonthYearStr()
    const today = getLocalDateStr()
    const total = daysInMonth(month)

    const isCurrentMonth = month === getLocalMonthYearStr()
    const dayOfMonth = isCurrentMonth ? Number(today.split('-')[2]) : total
    const remaining = Math.max(total - dayOfMonth, 0)

    const { data: rows, error } = await supabase
        .from('finances')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', month)

    if (error) throw error
    const finances = rows || []

    const income = finances
        .filter(f => f.type === 'Income')
        .reduce((s, f) => s + Number(f.amount), 0)

    const spent = finances
        .filter(f => f.type !== 'Income')
        .reduce((s, f) => s + Number(f.amount), 0)

    // Gastos fijos recurrentes que todavía no vencieron este mes.
    const upcomingItems = finances
        .filter(f =>
            f.type !== 'Income' &&
            f.is_recurring &&
            f.due_day &&
            Number(f.due_day) > dayOfMonth
        )
        .map(f => ({
            description: f.description as string,
            amount: Number(f.amount),
            dueDay: Number(f.due_day)
        }))
        .sort((a, b) => a.dueDay - b.dueDay)

    const upcomingFixed = upcomingItems.reduce((s, f) => s + f.amount, 0)

    // Ritmo de gasto variable: solo lo no recurrente, dividido por los días transcurridos.
    const variableSpent = finances
        .filter(f => f.type === 'Variable' || (f.type !== 'Income' && !f.is_recurring))
        .reduce((s, f) => s + Number(f.amount), 0)

    const dailyVariableRate = dayOfMonth > 0 ? variableSpent / dayOfMonth : 0
    const projectedVariable = Math.round(dailyVariableRate * remaining)

    const balanceToday = income - spent
    const projectedEndBalance = Math.round(balanceToday - upcomingFixed - projectedVariable)

    let status: ForecastStatus
    let headline: string
    let detail: string

    // El umbral amarillo es el 10% del ingreso: llegar raspando también es un problema.
    const cushion = income * 0.1

    if (projectedEndBalance < 0) {
        status = 'rojo'
        headline = `Al ritmo actual no llegás: te faltan ${money(Math.abs(projectedEndBalance))}`
        detail = `Quedan ${remaining} días. Tenés ${money(upcomingFixed)} de gastos fijos por vencer y venís gastando ${money(dailyVariableRate)} por día en variables.`
    } else if (projectedEndBalance < cushion) {
        status = 'amarillo'
        headline = `Llegás raspando: te sobrarían ${money(projectedEndBalance)}`
        detail = `Sin margen para imprevistos. Quedan ${remaining} días y ${money(upcomingFixed)} de fijos por pagar.`
    } else {
        status = 'verde'
        headline = `Vas bien: proyectás cerrar con ${money(projectedEndBalance)}`
        detail = remaining > 0
            ? `Quedan ${remaining} días y ${money(upcomingFixed)} de gastos fijos por vencer.`
            : 'El mes ya está cerrado.'
    }

    // Cuánto podés gastar por día sin quedar en rojo.
    const safeDailySpend = remaining > 0
        ? Math.max(Math.round((balanceToday - upcomingFixed) / remaining), 0)
        : 0

    return {
        monthYear: month,
        daysElapsed: dayOfMonth,
        daysRemaining: remaining,
        daysInMonth: total,
        income,
        spent,
        balanceToday,
        upcomingFixed,
        upcomingFixedItems: upcomingItems.slice(0, 6),
        projectedVariable,
        dailyVariableRate: Math.round(dailyVariableRate),
        projectedEndBalance,
        status,
        headline,
        detail,
        safeDailySpend
    }
}
