/**
 * Matemática de deudas.
 *
 * Todo acá es puro (sin Supabase, sin IA) para que lo pueda usar tanto el
 * servidor como el cliente y para poder razonar sobre los números sin pedirle
 * nada a un modelo: una tasa no se estima con prosa.
 *
 * Convención: todas las tasas se expresan en PORCENTAJE (5 = 5%), no en tanto
 * por uno. Las conversiones entre períodos son efectivas (compuestas), que es
 * lo que realmente pasa cuando el interés se capitaliza todos los días.
 */

export type InterestType = 'none' | 'daily' | 'monthly' | 'annual'

export interface DebtLike {
    id?: string
    creditor?: string
    remaining_amount: number | string
    total_amount?: number | string
    interest_type?: InterestType | null
    interest_rate_pct?: number | string | null
    estimated_daily_rate_pct?: number | string | null
    interest_capitalizes?: boolean | null
    interest_unknown?: boolean | null
    minimum_payment?: number | string | null
    due_day?: number | null
    plan_active?: boolean | null
    plan_installments?: number | null
    plan_installment_amount?: number | string | null
    plan_installments_paid?: number | null
    plan_total_amount?: number | string | null
}

function num(v: unknown, fallback = 0): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

/**
 * Tasa diaria efectiva de una deuda, en %.
 *
 * Si el usuario declaró la tasa, se usa esa. Si dijo que no la sabe, se usa la
 * estimada a partir de las observaciones ("el 3/9 debía X, el 20/9 debía Y").
 */
export function dailyRatePct(debt: DebtLike): number {
    const estimated = num(debt.estimated_daily_rate_pct, NaN)
    const declaredType = debt.interest_type || 'none'
    const declared = num(debt.interest_rate_pct, 0)

    if (debt.interest_unknown || declaredType === 'none') {
        return Number.isFinite(estimated) && estimated > 0 ? estimated : 0
    }

    if (declared <= 0) return Number.isFinite(estimated) && estimated > 0 ? estimated : 0

    switch (declaredType) {
        case 'daily':
            return declared
        case 'monthly':
            // Tasa efectiva diaria equivalente a la mensual (mes de 30 días).
            return (Math.pow(1 + declared / 100, 1 / 30) - 1) * 100
        case 'annual':
            return (Math.pow(1 + declared / 100, 1 / 365) - 1) * 100
        default:
            return 0
    }
}

/** De dónde salió la tasa que estamos usando: cambia lo que se le muestra al usuario. */
export function rateSource(debt: DebtLike): 'declarada' | 'estimada' | 'sin_datos' {
    const declaredType = debt.interest_type || 'none'
    const declared = num(debt.interest_rate_pct, 0)
    if (!debt.interest_unknown && declaredType !== 'none' && declared > 0) return 'declarada'
    if (num(debt.estimated_daily_rate_pct, 0) > 0) return 'estimada'
    return 'sin_datos'
}

/** Lo que esta deuda te cuesta hoy, solo por existir. */
export function dailyInterestCost(debt: DebtLike): number {
    return num(debt.remaining_amount) * (dailyRatePct(debt) / 100)
}

/** Cuánto va a ser la deuda dentro de `days` días si no pagás nada. */
export function projectDebt(debt: DebtLike, days: number): number {
    const balance = num(debt.remaining_amount)
    const dr = dailyRatePct(debt) / 100
    if (dr <= 0 || days <= 0) return balance

    // Capitaliza = interés sobre interés. Sin capitalizar = interés simple.
    return debt.interest_capitalizes === false
        ? balance * (1 + dr * days)
        : balance * Math.pow(1 + dr, days)
}

/** Cuánto interés se acumula en `days` días. */
export function interestOver(debt: DebtLike, days: number): number {
    return projectDebt(debt, days) - num(debt.remaining_amount)
}

/**
 * Tasa diaria implícita entre dos observaciones reales de saldo.
 *
 * Es la respuesta a "no sé cuánto interés me generan": no hace falta que el
 * acreedor te diga la tasa, alcanza con anotar cuánto debías en dos fechas.
 * Devuelve null si los datos no alcanzan o no tienen sentido.
 */
export function impliedDailyRatePct(
    from: { observed_on: string; observed_amount: number | string },
    to: { observed_on: string; observed_amount: number | string },
    /** Pagos hechos entre ambas fechas: sin esto la tasa sale subestimada. */
    paymentsBetween = 0
): number | null {
    const days = daysBetween(from.observed_on, to.observed_on)
    if (days <= 0) return null

    const start = num(from.observed_amount)
    const end = num(to.observed_amount) + num(paymentsBetween)
    if (start <= 0 || end <= 0) return null
    if (end <= start) return 0

    const rate = (Math.pow(end / start, 1 / days) - 1) * 100
    return Number.isFinite(rate) ? rate : null
}

/** Días calendario entre dos fechas YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
    const [y1, m1, d1] = a.split('-').map(Number)
    const [y2, m2, d2] = b.split('-').map(Number)
    const t1 = Date.UTC(y1, m1 - 1, d1)
    const t2 = Date.UTC(y2, m2 - 1, d2)
    return Math.round((t2 - t1) / 86400000)
}

/** Conversión de diaria a mensual efectiva (30 días), para mostrarlo legible. */
export function dailyToMonthlyPct(dailyPct: number): number {
    return (Math.pow(1 + dailyPct / 100, 30) - 1) * 100
}

export interface PlanState {
    installmentsLeft: number
    remainingUnderPlan: number
    /** Costo total del plan vs. el saldo actual: cuánto de más pagás por financiar. */
    financingCost: number
}

export function planState(debt: DebtLike): PlanState | null {
    if (!debt.plan_active || !debt.plan_installments) return null

    const total = num(debt.plan_installments)
    const paid = num(debt.plan_installments_paid)
    const amount = num(debt.plan_installment_amount)
    const left = Math.max(total - paid, 0)
    const planTotal = num(debt.plan_total_amount, amount * total)

    return {
        installmentsLeft: left,
        remainingUnderPlan: left * amount,
        financingCost: planTotal - num(debt.total_amount, num(debt.remaining_amount))
    }
}

export type PayoffMethod = 'avalancha' | 'bola_de_nieve'

/**
 * Ordena las deudas para pagarlas.
 *
 * - Avalancha: primero la que más interés genera por día. Es la que menos plata
 *   te cuesta en total.
 * - Bola de nieve: primero la más chica. Cuesta más plata pero da victorias
 *   rápidas, que es lo que sostiene el plan cuando venís remando.
 *
 * Las deudas que ya están en plan de pago no compiten: su cuota es un gasto
 * fijo del mes, no una decisión abierta.
 */
export function orderDebts<T extends DebtLike>(debts: T[], method: PayoffMethod = 'avalancha'): T[] {
    const open = debts.filter(d => !d.plan_active && num(d.remaining_amount) > 0)

    return [...open].sort((a, b) => {
        if (method === 'bola_de_nieve') {
            return num(a.remaining_amount) - num(b.remaining_amount)
        }
        const costDiff = dailyInterestCost(b) - dailyInterestCost(a)
        if (Math.abs(costDiff) > 0.01) return costDiff
        // Empate (por ejemplo, dos deudas sin interés): gana la más chica.
        return num(a.remaining_amount) - num(b.remaining_amount)
    })
}

/**
 * ¿Conviene financiar esta deuda en cuotas?
 *
 * Regla simple y honesta: si la tasa del plan es más baja que la que ya te
 * están cobrando, financiar te ahorra plata. Si es más alta, solo te compra
 * aire — y eso a veces vale, pero hay que saber cuánto cuesta.
 */
export function evaluatePaymentPlan(
    debt: DebtLike,
    plan: { installments: number; installmentAmount: number }
): {
    planTotal: number
    extraOverBalance: number
    impliedMonthlyRatePct: number
    currentMonthlyRatePct: number
    verdict: 'conviene' | 'caro' | 'sin_datos'
    explanation: string
} {
    const balance = num(debt.remaining_amount)
    const planTotal = plan.installments * plan.installmentAmount
    const extra = planTotal - balance

    const currentDaily = dailyRatePct(debt)
    const currentMonthly = dailyToMonthlyPct(currentDaily)

    // Tasa mensual implícita del plan, aproximada sobre el saldo promedio.
    const avgBalance = balance / 2
    const months = plan.installments
    const impliedMonthly = avgBalance > 0 && months > 0
        ? (extra / avgBalance / months) * 100
        : 0

    if (currentDaily <= 0) {
        return {
            planTotal,
            extraOverBalance: extra,
            impliedMonthlyRatePct: impliedMonthly,
            currentMonthlyRatePct: 0,
            verdict: 'sin_datos',
            explanation: extra > 0
                ? `Esta deuda no tiene interés cargado, así que financiarla te agrega ${Math.round(extra).toLocaleString('es-AR')} pesos de costo puro. Cargá la tasa real para poder comparar.`
                : 'Esta deuda no tiene interés cargado. Cargá la tasa real para poder comparar el plan.'
        }
    }

    const verdict = impliedMonthly < currentMonthly ? 'conviene' : 'caro'

    return {
        planTotal,
        extraOverBalance: extra,
        impliedMonthlyRatePct: impliedMonthly,
        currentMonthlyRatePct: currentMonthly,
        verdict,
        explanation: verdict === 'conviene'
            ? `El plan sale ~${impliedMonthly.toFixed(1)}% mensual y hoy te están cobrando ~${currentMonthly.toFixed(1)}%. Financiar te frena el sangrado.`
            : `El plan sale ~${impliedMonthly.toFixed(1)}% mensual y hoy te cobran ~${currentMonthly.toFixed(1)}%. Financiar te da aire pero te sale más caro.`
    }
}
