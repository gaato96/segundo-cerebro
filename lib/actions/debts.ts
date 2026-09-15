'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { getLocalDateStr, getLocalMonthYearStr, addDaysToDateStr } from '@/lib/utils'
import {
    dailyRatePct, dailyInterestCost, projectDebt, interestOver, rateSource,
    dailyToMonthlyPct, impliedDailyRatePct, orderDebts, planState,
    evaluatePaymentPlan, type InterestType, type PayoffMethod
} from '@/lib/debtMath'

/**
 * Deudas: lo que realmente cuestan y qué hacer con ellas.
 *
 * Tres problemas concretos que resuelve este módulo:
 *  1. El interés diario que no sabés cuánto es → se estima con observaciones.
 *  2. Financiar o no financiar → se compara la tasa del plan con la vigente.
 *  3. Con qué plata pago qué → la asignación se calcula, no se improvisa.
 */

export interface DebtView {
    id: string
    creditor: string
    kind: string
    total_amount: number
    remaining_amount: number
    interest_type: InterestType
    interest_rate_pct: number
    interest_unknown: boolean
    estimated_daily_rate_pct: number | null
    interest_capitalizes: boolean
    minimum_payment: number | null
    due_day: number | null
    status: string
    notes: string | null
    plan_active: boolean
    plan_installments: number | null
    plan_installment_amount: number | null
    plan_installments_paid: number
    plan_first_due_date: string | null
    plan_due_day: number | null
    plan_total_amount: number | null
    plan_notes: string | null
    // Derivados
    dailyRatePct: number
    monthlyRatePct: number
    rateSource: 'declarada' | 'estimada' | 'sin_datos'
    dailyCost: number
    monthlyCost: number
    in30Days: number
    interest30Days: number
    installmentsLeft: number | null
    remainingUnderPlan: number | null
    observations: { id: string; observed_on: string; observed_amount: number; note: string | null }[]
}

export interface DebtsOverview {
    debts: DebtView[]
    totals: {
        remaining: number
        dailyCost: number
        monthlyCost: number
        in30Days: number
        monthlyInstallments: number
        withUnknownRate: number
    }
    order: { avalancha: string[]; bola_de_nieve: string[] }
}

function n(v: unknown, fallback = 0): number {
    const x = Number(v)
    return Number.isFinite(x) ? x : fallback
}

export async function getDebtsOverview(): Promise<DebtsOverview> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return emptyOverview()

    const [debtsRes, obsRes] = await Promise.all([
        supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('debt_observations').select('*').eq('user_id', user.id).order('observed_on', { ascending: false })
    ])

    const rows = debtsRes.data || []
    const allObs = obsRes.data || []

    const debts: DebtView[] = rows.map((d: any) => {
        const daily = dailyRatePct(d)
        const observations = allObs
            .filter((o: any) => o.debt_id === d.id)
            .map((o: any) => ({
                id: o.id,
                observed_on: o.observed_on,
                observed_amount: n(o.observed_amount),
                note: o.note
            }))

        const plan = planState(d)

        return {
            id: d.id,
            creditor: d.creditor,
            kind: d.kind || 'otro',
            total_amount: n(d.total_amount),
            remaining_amount: n(d.remaining_amount),
            interest_type: (d.interest_type || 'none') as InterestType,
            interest_rate_pct: n(d.interest_rate_pct),
            interest_unknown: Boolean(d.interest_unknown),
            estimated_daily_rate_pct: d.estimated_daily_rate_pct != null ? n(d.estimated_daily_rate_pct) : null,
            interest_capitalizes: d.interest_capitalizes !== false,
            minimum_payment: d.minimum_payment != null ? n(d.minimum_payment) : null,
            due_day: d.due_day ?? null,
            status: d.status || 'active',
            notes: d.notes ?? null,
            plan_active: Boolean(d.plan_active),
            plan_installments: d.plan_installments ?? null,
            plan_installment_amount: d.plan_installment_amount != null ? n(d.plan_installment_amount) : null,
            plan_installments_paid: n(d.plan_installments_paid),
            plan_first_due_date: d.plan_first_due_date ?? null,
            plan_due_day: d.plan_due_day ?? null,
            plan_total_amount: d.plan_total_amount != null ? n(d.plan_total_amount) : null,
            plan_notes: d.plan_notes ?? null,
            dailyRatePct: daily,
            monthlyRatePct: dailyToMonthlyPct(daily),
            rateSource: rateSource(d),
            dailyCost: dailyInterestCost(d),
            monthlyCost: interestOver(d, 30),
            in30Days: projectDebt(d, 30),
            interest30Days: interestOver(d, 30),
            installmentsLeft: plan?.installmentsLeft ?? null,
            remainingUnderPlan: plan?.remainingUnderPlan ?? null,
            observations
        }
    })

    const open = debts.filter(d => d.remaining_amount > 0)

    return {
        debts,
        totals: {
            remaining: open.reduce((s, d) => s + d.remaining_amount, 0),
            dailyCost: open.reduce((s, d) => s + d.dailyCost, 0),
            monthlyCost: open.reduce((s, d) => s + d.monthlyCost, 0),
            in30Days: open.reduce((s, d) => s + d.in30Days, 0),
            monthlyInstallments: debts
                .filter(d => d.plan_active && (d.installmentsLeft || 0) > 0)
                .reduce((s, d) => s + (d.plan_installment_amount || 0), 0),
            withUnknownRate: open.filter(d => d.rateSource === 'sin_datos').length
        },
        order: {
            avalancha: orderDebts(open, 'avalancha').map(d => d.id),
            bola_de_nieve: orderDebts(open, 'bola_de_nieve').map(d => d.id)
        }
    }
}

function emptyOverview(): DebtsOverview {
    return {
        debts: [],
        totals: { remaining: 0, dailyCost: 0, monthlyCost: 0, in30Days: 0, monthlyInstallments: 0, withUnknownRate: 0 },
        order: { avalancha: [], bola_de_nieve: [] }
    }
}

// ============================================================
// ALTA Y EDICIÓN
// ============================================================

export interface DebtInput {
    id?: string
    creditor: string
    kind?: string
    total_amount: number
    remaining_amount?: number
    interest_type?: InterestType
    interest_rate_pct?: number
    interest_unknown?: boolean
    interest_capitalizes?: boolean
    minimum_payment?: number | null
    due_day?: number | null
    notes?: string | null
}

export async function saveDebt(input: DebtInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (!input.creditor?.trim()) return { error: 'Falta el nombre del acreedor.' }
    if (!(input.total_amount > 0)) return { error: 'El monto tiene que ser mayor a cero.' }

    const payload = {
        user_id: user.id,
        creditor: input.creditor.trim(),
        kind: input.kind || 'otro',
        total_amount: input.total_amount,
        remaining_amount: input.remaining_amount ?? input.total_amount,
        interest_type: input.interest_unknown ? 'none' : (input.interest_type || 'none'),
        interest_rate_pct: input.interest_unknown ? 0 : (input.interest_rate_pct || 0),
        interest_unknown: Boolean(input.interest_unknown),
        interest_capitalizes: input.interest_capitalizes !== false,
        minimum_payment: input.minimum_payment ?? null,
        due_day: input.due_day ?? null,
        notes: input.notes ?? null
    }

    const { error } = input.id
        ? await supabase.from('debts').update(payload).eq('id', input.id).eq('user_id', user.id)
        : await supabase.from('debts').insert(payload)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function deleteDebtById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase.from('debts').delete().eq('id', id).eq('user_id', user.id)
    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

// ============================================================
// OBSERVACIONES: DEDUCIR LA TASA QUE NO SABÉS
// ============================================================

/**
 * Anota cuánto debías realmente en una fecha. Con dos de estas, el sistema
 * calcula solo la tasa diaria que te están cobrando.
 */
export async function addDebtObservation(debtId: string, observedOn: string, observedAmount: number, note?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (!(observedAmount > 0)) return { error: 'El saldo observado tiene que ser mayor a cero.' }

    const { error } = await supabase
        .from('debt_observations')
        .upsert({
            user_id: user.id,
            debt_id: debtId,
            observed_on: observedOn,
            observed_amount: observedAmount,
            note: note || null
        }, { onConflict: 'debt_id, observed_on' })

    if (error) return { error: error.message }

    // Cada observación nueva recalcula la tasa estimada.
    const recalc = await recalcEstimatedRate(debtId)

    revalidatePath('/finances')
    return { success: true, ...recalc }
}

export async function deleteDebtObservation(id: string, debtId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase.from('debt_observations').delete().eq('id', id).eq('user_id', user.id)
    if (error) return { error: error.message }

    await recalcEstimatedRate(debtId)
    revalidatePath('/finances')
    return { success: true }
}

/**
 * Recalcula la tasa diaria implícita usando la primera y la última observación.
 * Descuenta los pagos hechos en el medio: sin eso, la tasa sale subestimada
 * porque el saldo bajó por los pagos, no porque no haya interés.
 */
export async function recalcEstimatedRate(debtId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { estimated: null as number | null }

    const { data: obs } = await supabase
        .from('debt_observations')
        .select('*')
        .eq('user_id', user.id)
        .eq('debt_id', debtId)
        .order('observed_on', { ascending: true })

    if (!obs || obs.length < 2) {
        await supabase.from('debts').update({ estimated_daily_rate_pct: null }).eq('id', debtId).eq('user_id', user.id)
        return { estimated: null, reason: 'Hacen falta al menos dos observaciones en fechas distintas.' }
    }

    const first = obs[0]
    const last = obs[obs.length - 1]

    // Pagos registrados a esta deuda entre ambas fechas.
    const { data: payments } = await supabase
        .from('finances')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .eq('debt_id', debtId)
        .eq('type', 'Debt_Payment')
        .gte('created_at', `${first.observed_on}T00:00:00-03:00`)
        .lte('created_at', `${last.observed_on}T23:59:59-03:00`)

    const paid = (payments || []).reduce((s: number, p: any) => s + n(p.amount), 0)

    const rate = impliedDailyRatePct(first, last, paid)

    await supabase
        .from('debts')
        .update({ estimated_daily_rate_pct: rate })
        .eq('id', debtId)
        .eq('user_id', user.id)

    return {
        estimated: rate,
        monthlyEquivalent: rate != null ? dailyToMonthlyPct(rate) : null,
        paymentsConsidered: paid,
        from: first.observed_on,
        to: last.observed_on
    }
}

// ============================================================
// PLANES DE PAGO
// ============================================================

/** Simula un plan antes de aceptarlo: ¿te ahorra plata o solo te da aire? */
export async function simulatePaymentPlan(debtId: string, installments: number, installmentAmount: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: debt } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!debt) return { error: 'Esa deuda ya no existe.' }

    const evaluation = evaluatePaymentPlan(debt, { installments, installmentAmount })

    // Contra qué se compara: dejarla como está y pagarla recién al final del plan.
    const doNothing = projectDebt(debt, installments * 30)

    return {
        success: true,
        ...evaluation,
        doNothingAmount: doNothing,
        savingsVsDoNothing: doNothing - evaluation.planTotal
    }
}

export async function setPaymentPlan(input: {
    debtId: string
    installments: number
    installmentAmount: number
    firstDueDate?: string | null
    dueDay?: number | null
    totalAmount?: number | null
    notes?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (!(input.installments > 0)) return { error: 'La cantidad de cuotas tiene que ser mayor a cero.' }
    if (!(input.installmentAmount > 0)) return { error: 'El monto de la cuota tiene que ser mayor a cero.' }

    const planTotal = input.totalAmount ?? input.installments * input.installmentAmount

    const { error } = await supabase
        .from('debts')
        .update({
            plan_active: true,
            status: 'in_plan',
            plan_installments: input.installments,
            plan_installment_amount: input.installmentAmount,
            plan_first_due_date: input.firstDueDate || null,
            plan_due_day: input.dueDay || null,
            plan_total_amount: planTotal,
            plan_notes: input.notes || null,
            // Bajo un plan, lo que debés pasa a ser el total del plan (incluye el
            // costo de financiar). Si no, al pagar las cuotas el saldo llegaría a
            // cero antes de tiempo y el trigger de pagos dejaría de tener sentido.
            remaining_amount: planTotal,
            // Una deuda financiada deja de correr con la tasa punitoria vieja.
            interest_type: 'none',
            interest_rate_pct: 0,
            interest_unknown: false
        })
        .eq('id', input.debtId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function cancelPaymentPlan(debtId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('debts')
        .update({ plan_active: false, status: 'active' })
        .eq('id', debtId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

/**
 * Registra una cuota pagada: baja el saldo, suma al contador del plan y deja
 * el movimiento en finanzas para que aparezca en el mes.
 */
export async function payInstallment(debtId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: debt } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!debt) return { error: 'Esa deuda ya no existe.' }
    if (!debt.plan_active) return { error: 'Esta deuda no tiene un plan de pago activo.' }

    const amount = n(debt.plan_installment_amount)
    const paid = n(debt.plan_installments_paid) + 1
    const total = n(debt.plan_installments)

    // El trigger de finances descuenta el saldo al insertar el pago.
    const { error: txError } = await supabase.from('finances').insert({
        user_id: user.id,
        type: 'Debt_Payment',
        description: `Cuota ${paid}/${total} · ${debt.creditor}`,
        amount,
        category: 'Deudas',
        debt_id: debtId,
        month_year: getLocalMonthYearStr()
    })

    if (txError) return { error: txError.message }

    const { error } = await supabase
        .from('debts')
        .update({
            plan_installments_paid: paid,
            ...(paid >= total ? { status: 'paid', plan_active: false } : {})
        })
        .eq('id', debtId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    revalidatePath('/')
    return { success: true, installmentsPaid: paid, finished: paid >= total }
}

/** Pago suelto a una deuda (no cuota de plan). */
export async function payDebtAmount(debtId: string, amount: number, description?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }
    if (!(amount > 0)) return { error: 'El monto tiene que ser mayor a cero.' }

    const { data: debt } = await supabase
        .from('debts')
        .select('creditor')
        .eq('id', debtId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!debt) return { error: 'Esa deuda ya no existe.' }

    const { error } = await supabase.from('finances').insert({
        user_id: user.id,
        type: 'Debt_Payment',
        description: description || `Pago a ${debt.creditor}`,
        amount,
        category: 'Deudas',
        debt_id: debtId,
        month_year: getLocalMonthYearStr()
    })

    if (error) return { error: error.message }

    revalidatePath('/finances')
    revalidatePath('/')
    return { success: true }
}

// ============================================================
// EL ASESOR: QUÉ PAGAR PRIMERO
// ============================================================

export interface DebtStrategy {
    headline: string
    diagnosis: string
    recommended_method: PayoffMethod
    method_reason: string
    order: { debt_id: string; creditor: string; position: number; action: string; why: string }[]
    refinance: { debt_id: string; creditor: string; verdict: 'financiar' | 'no_financiar'; why: string }[]
    warnings: string[]
    next_step: string
}

export async function getDebtStrategy(method?: PayoffMethod): Promise<ActionResult<DebtStrategy>> {
    return runAction('getDebtStrategy', () => buildDebtStrategy(method))
}

async function buildDebtStrategy(method?: PayoffMethod): Promise<DebtStrategy> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const [overview, incomeCtx] = await Promise.all([
        getDebtsOverview(),
        buildIncomeContext()
    ])

    const open = overview.debts.filter(d => d.remaining_amount > 0)
    if (!open.length) throw new Error('No tenés deudas cargadas. Cargá al menos una para que el asesor pueda ayudarte.')

    const money = (x: number) => `$${Math.round(x).toLocaleString('es-AR')}`

    const debtLines = open.map((d, i) => {
        const bits = [
            `[${i}] ${d.creditor} (${d.kind})`,
            `saldo ${money(d.remaining_amount)}`,
            d.rateSource === 'sin_datos'
                ? 'TASA DESCONOCIDA (no cargó ni estimó nada)'
                : `tasa ${d.dailyRatePct.toFixed(3)}%/día ≈ ${d.monthlyRatePct.toFixed(1)}%/mes (${d.rateSource})`,
            d.dailyCost > 0 ? `le cuesta ${money(d.dailyCost)} por día` : 'sin costo diario conocido',
            d.plan_active
                ? `EN PLAN DE PAGO: ${d.installmentsLeft} cuotas de ${money(d.plan_installment_amount || 0)} pendientes`
                : 'sin plan de pago',
            d.minimum_payment ? `pago mínimo ${money(d.minimum_payment)}` : '',
            d.due_day ? `vence el día ${d.due_day}` : ''
        ].filter(Boolean)
        return bits.join(' · ')
    }).join('\n')

    const prompt = `
Sos el asesor financiero personal del usuario. Vive en Tucumán, Argentina, y todo está en pesos argentinos.

SITUACIÓN DE INGRESOS:
${incomeCtx}

DEUDAS (numeradas):
${debtLines}

TOTALES:
- Deuda total: ${money(overview.totals.remaining)}
- Le corre ${money(overview.totals.dailyCost)} de interés POR DÍA (≈ ${money(overview.totals.monthlyCost)} por mes)
- Cuotas fijas de planes ya activos: ${money(overview.totals.monthlyInstallments)} por mes
- Deudas sin tasa conocida: ${overview.totals.withUnknownRate}

Orden matemático por avalancha (la que más interés genera primero): ${overview.order.avalancha.map(id => open.find(d => d.id === id)?.creditor).filter(Boolean).join(' → ')}
Orden por bola de nieve (la más chica primero): ${overview.order.bola_de_nieve.map(id => open.find(d => d.id === id)?.creditor).filter(Boolean).join(' → ')}
${method ? `El usuario prefiere el método: ${method}.` : ''}

Tu trabajo:
1. Elegí un método (avalancha o bola_de_nieve) y justificalo con SU situación, no con teoría. Si el ingreso fijo no cubre los gastos, decilo sin vueltas: ahí el orden importa menos que conseguir ingreso.
2. Ordená las deudas y para cada una decí qué hacer concretamente (pagar completo, pagar el mínimo, negociar, congelar, ignorar por ahora).
3. Para cada deuda decidí si conviene pedir plan de pago o no. Financiar algo con tasa baja para poder atacar lo que sangra al 1% diario suele ser correcto; financiar todo no lo es.
4. Si hay deudas sin tasa conocida, la primera acción es AVERIGUARLA: no se puede priorizar a ciegas.
5. "next_step" es UNA sola cosa para hacer hoy, que entre en 30 minutos.

Reglas de tono: español rioplatense con voseo, directo, sin moralina y sin tratarlo de irresponsable. Números concretos, no generalidades.

Respondé SOLO con este JSON:
{
  "headline": "una frase que resuma la situación con un número real",
  "diagnosis": "2 o 3 frases sobre qué está pasando de verdad",
  "recommended_method": "avalancha",
  "method_reason": "...",
  "order": [ { "index": 0, "action": "...", "why": "..." } ],
  "refinance": [ { "index": 0, "verdict": "financiar", "why": "..." } ],
  "warnings": ["..."],
  "next_step": "..."
}`.trim()

    const text = await generateText(prompt, { temperature: 0.5, maxOutputTokens: 2600, json: true })
    const parsed = parseJSON<any>(text)

    const order = (Array.isArray(parsed.order) ? parsed.order : [])
        .filter((o: any) => typeof o?.index === 'number' && open[o.index])
        .map((o: any, i: number) => ({
            debt_id: open[o.index].id,
            creditor: open[o.index].creditor,
            position: i + 1,
            action: o.action || '',
            why: o.why || ''
        }))

    const refinance = (Array.isArray(parsed.refinance) ? parsed.refinance : [])
        .filter((r: any) => typeof r?.index === 'number' && open[r.index])
        .map((r: any) => ({
            debt_id: open[r.index].id,
            creditor: open[r.index].creditor,
            verdict: r.verdict === 'financiar' ? 'financiar' as const : 'no_financiar' as const,
            why: r.why || ''
        }))

    return {
        headline: parsed.headline || '',
        diagnosis: parsed.diagnosis || '',
        recommended_method: parsed.recommended_method === 'bola_de_nieve' ? 'bola_de_nieve' : 'avalancha',
        method_reason: parsed.method_reason || '',
        order,
        refinance,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean).map(String) : [],
        next_step: parsed.next_step || ''
    }
}

// ============================================================
// ASIGNACIÓN DE UN INGRESO
// ============================================================

export interface AllocationPlan {
    amount: number
    items: { label: string; amount: number; reason: string; target_type: 'debt' | 'expense' | 'buffer' | 'goal'; target_id: string | null }[]
    leftover: number
    rationale: string
    warning: string | null
}

/** "Me entraron $X. ¿A qué lo destino?" — la pregunta cara del mes. */
export async function allocateIncome(amount: number, label?: string): Promise<ActionResult<AllocationPlan>> {
    return runAction('allocateIncome', () => buildAllocation(amount, label))
}

async function buildAllocation(amount: number, label?: string): Promise<AllocationPlan> {
    if (!(amount > 0)) throw new Error('Poné cuánto te entró para poder repartirlo.')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const monthYear = getLocalMonthYearStr()
    const today = getLocalDateStr()
    const dayOfMonth = Number(today.split('-')[2])

    const [overview, incomeCtx, financesRes] = await Promise.all([
        getDebtsOverview(),
        buildIncomeContext(),
        supabase.from('finances').select('*').eq('user_id', user.id).eq('month_year', monthYear)
    ])

    const finances = financesRes.data || []
    const money = (x: number) => `$${Math.round(x).toLocaleString('es-AR')}`

    const spent = finances.filter((f: any) => f.type !== 'Income').reduce((s: number, f: any) => s + n(f.amount), 0)
    const received = finances.filter((f: any) => f.type === 'Income').reduce((s: number, f: any) => s + n(f.amount), 0)

    const upcomingFixed = finances
        .filter((f: any) => f.type !== 'Income' && f.is_recurring && f.due_day && Number(f.due_day) >= dayOfMonth)
        .map((f: any) => `${f.description} ${money(n(f.amount))} (vence el ${f.due_day})`)

    const open = overview.debts.filter(d => d.remaining_amount > 0)

    const debtLines = open.map((d, i) => [
        `[${i}] ${d.creditor}`,
        `saldo ${money(d.remaining_amount)}`,
        d.rateSource === 'sin_datos' ? 'tasa desconocida' : `${d.monthlyRatePct.toFixed(1)}%/mes`,
        d.dailyCost > 0 ? `${money(d.dailyCost)}/día de interés` : '',
        d.plan_active ? `cuota ${money(d.plan_installment_amount || 0)} (${d.installmentsLeft} restantes)` : '',
        d.due_day ? `vence el ${d.due_day}` : ''
    ].filter(Boolean).join(' · ')).join('\n')

    const prompt = `
Al usuario le acaban de entrar ${money(amount)}${label ? ` (${label})` : ''}. Vive en Tucumán, Argentina. Todo en pesos argentinos. Hoy es ${today}.

INGRESOS:
${incomeCtx}

MES EN CURSO (${monthYear}):
- Ya ingresaron ${money(received)} y ya gastó ${money(spent)}.
- Gastos fijos que todavía faltan pagar este mes: ${upcomingFixed.length ? upcomingFixed.join(' | ') : 'ninguno cargado'}

DEUDAS (numeradas):
${debtLines || 'no tiene deudas cargadas'}

Total de deuda: ${money(overview.totals.remaining)} · le corre ${money(overview.totals.dailyCost)} de interés por día · cuotas de planes ya comprometidas: ${money(overview.totals.monthlyInstallments)}/mes.

Repartí esos ${money(amount)} en una lista concreta. Reglas duras:
- La suma de los montos NO puede superar ${Math.round(amount)}. Si sobra, va a "leftover".
- Primero lo que ya está comprometido y vence pronto (cuotas de planes, fijos por vencer), después lo que más interés genera.
- Si su ingreso fijo no cubre los gastos del mes, dejá un colchón explícito ("buffer") antes de matar deuda: quedarse sin plata a mitad de mes genera MÁS deuda.
- No propongas ahorrar mientras haya deuda corriendo a tasa alta, salvo el colchón mínimo.
- target_type: "debt" (usá el número de la deuda como index), "expense", "buffer" o "goal".
- Montos redondeados a múltiplos de 1000.
- Español rioplatense con voseo. Concreto, sin sermones.

Respondé SOLO con este JSON:
{
  "items": [ { "label": "...", "amount": 50000, "reason": "...", "target_type": "debt", "index": 0 } ],
  "leftover": 0,
  "rationale": "2 frases sobre por qué este reparto y no otro",
  "warning": "... o null"
}`.trim()

    const text = await generateText(prompt, { temperature: 0.4, maxOutputTokens: 2000, json: true })
    const parsed = parseJSON<any>(text)

    let running = 0
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
        .map((it: any) => {
            const raw = Math.max(Math.round(n(it.amount)), 0)
            // La IA a veces se pasa del total: se recorta acá, no se confía.
            const capped = Math.min(raw, Math.max(amount - running, 0))
            running += capped
            const targetDebt = it.target_type === 'debt' && typeof it.index === 'number' ? open[it.index] : null
            return {
                label: it.label || targetDebt?.creditor || 'Sin etiqueta',
                amount: capped,
                reason: it.reason || '',
                target_type: (['debt', 'expense', 'buffer', 'goal'].includes(it.target_type) ? it.target_type : 'expense') as AllocationPlan['items'][number]['target_type'],
                target_id: targetDebt?.id || null
            }
        })
        .filter((it: any) => it.amount > 0)

    return {
        amount,
        items,
        leftover: Math.max(amount - running, 0),
        rationale: parsed.rationale || '',
        warning: parsed.warning && String(parsed.warning).toLowerCase() !== 'null' ? String(parsed.warning) : null
    }
}

/** Guarda el reparto para poder mirarlo después y ver si se cumplió. */
export async function saveIncomeAllocation(plan: AllocationPlan, sourceLabel?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase.from('income_allocations').insert({
        user_id: user.id,
        date: getLocalDateStr(),
        amount: plan.amount,
        source_label: sourceLabel || null,
        plan_json: plan.items,
        rationale: plan.rationale
    })

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function getIncomeAllocations(limit = 10) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('income_allocations')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(limit)

    return data || []
}

/**
 * Ejecuta el reparto: registra los pagos a deudas que propuso el plan.
 * Solo toca lo que va a deudas; el resto es información para el usuario.
 */
export async function applyAllocation(plan: AllocationPlan, sourceLabel?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    let applied = 0
    const failures: string[] = []

    for (const item of plan.items) {
        if (item.target_type !== 'debt' || !item.target_id) continue
        const res = await payDebtAmount(item.target_id, item.amount, `${item.label}${sourceLabel ? ` (${sourceLabel})` : ''}`)
        if ('error' in res && res.error) failures.push(`${item.label}: ${res.error}`)
        else applied++
    }

    await saveIncomeAllocation(plan, sourceLabel)

    revalidatePath('/finances')
    revalidatePath('/')
    return { success: true, applied, failures }
}

// ============================================================
// CONTEXTO DE INGRESOS (compartido por el asesor y la asignación)
// ============================================================

async function buildIncomeContext(): Promise<string> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return '(sin datos)'

    const { data: sources } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

    if (!sources?.length) {
        return '(el usuario todavía no cargó sus fuentes de ingreso. Sugerile cargarlas: sin eso cualquier plan es a ciegas.)'
    }

    const money = (x: number) => `$${Math.round(x).toLocaleString('es-AR')}`
    const KIND: Record<string, string> = {
        fixed: 'ingreso fijo',
        variable: 'ingreso variable (puede no entrar)',
        installments: 'cobro en cuotas',
        recurring: 'ingreso recurrente'
    }

    const lines = sources.map((s: any) => {
        const bits = [`- ${s.name}${s.client ? ` (${s.client})` : ''}: ${KIND[s.kind] || s.kind}, ${money(n(s.amount))}`]
        if (s.kind === 'installments' && s.installments_total) {
            bits.push(`cuota ${n(s.installments_paid) + 1} de ${s.installments_total}`)
        }
        if (s.kind === 'recurring' && s.frequency_months > 1) bits.push(`cada ${s.frequency_months} meses`)
        if (s.expected_day) bits.push(`entra cerca del día ${s.expected_day}`)
        bits.push(`certeza: ${s.confidence}`)
        if (s.notes) bits.push(String(s.notes).slice(0, 120))
        return bits.join(' · ')
    })

    const confirmed = sources
        .filter((s: any) => s.confidence === 'confirmada')
        .reduce((acc: number, s: any) => acc + n(s.amount) / Math.max(n(s.frequency_months, 1), 1), 0)

    const optimistic = sources
        .reduce((acc: number, s: any) => acc + n(s.amount) / Math.max(n(s.frequency_months, 1), 1), 0)

    lines.push(`- Piso mensual (solo lo confirmado): ${money(confirmed)}`)
    lines.push(`- Techo mensual (si entra todo, incluido lo incierto): ${money(optimistic)}`)

    return lines.join('\n')
}

/** El piso y el techo de ingreso del mes, para mostrarlo en pantalla. */
export async function getIncomeRange() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { floor: 0, ceiling: 0, sources: 0 }

    const { data: sources } = await supabase
        .from('income_sources')
        .select('amount, confidence, frequency_months')
        .eq('user_id', user.id)
        .eq('is_active', true)

    const list = sources || []
    const monthly = (s: any) => n(s.amount) / Math.max(n(s.frequency_months, 1), 1)

    return {
        floor: list.filter((s: any) => s.confidence === 'confirmada').reduce((acc: number, s: any) => acc + monthly(s), 0),
        ceiling: list.reduce((acc: number, s: any) => acc + monthly(s), 0),
        sources: list.length
    }
}

/** Fechas estimadas de cobro de los próximos 60 días, para saber cuándo hay aire. */
export async function getUpcomingIncome() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: sources } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

    const today = getLocalDateStr()
    const horizon = addDaysToDateStr(today, 60)
    const out: { date: string; name: string; amount: number; confidence: string; kind: string }[] = []

    for (const s of sources || []) {
        if (!s.expected_day) continue
        const amount = n(s.amount)
        if (amount <= 0) continue

        // Próximas dos ocurrencias: alcanza para cubrir 60 días.
        for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
            const [y, m] = today.split('-').map(Number)
            const target = new Date(y, m - 1 + monthOffset, Math.min(s.expected_day, 28))
            const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
            if (dateStr < today || dateStr > horizon) continue

            // Un cobro en cuotas se termina cuando se terminan las cuotas.
            if (s.kind === 'installments' && s.installments_total) {
                const left = n(s.installments_total) - n(s.installments_paid)
                if (left <= monthOffset) continue
            }
            if (s.kind === 'recurring' && n(s.frequency_months, 1) > 1 && monthOffset % n(s.frequency_months, 1) !== 0) continue

            out.push({ date: dateStr, name: s.name, amount, confidence: s.confidence, kind: s.kind })
        }
    }

    return out.sort((a, b) => a.date.localeCompare(b.date))
}
