'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { getLocalDateStr } from '@/lib/utils'
import { getDebtsOverview, getIncomeRange } from '@/lib/actions/debts'
import {
    summarize, compareCategories, rangeFor, previousRange, shiftDate,
    type ExpenseRecord, type SpendingSummary
} from '@/lib/spendingMath'
import { getCategory, PAYMENT_METHODS, type Necessity, type PaymentMethod } from '@/lib/expenseCategories'
import {
    recommendPlan, normalizeBuckets, BUCKETS, PHASE_INFO, INVESTMENT_OPTIONS,
    type BucketPlan, type PlanInputs, type PlanRecommendation
} from '@/lib/moneyPlan'

/**
 * Registro diario de gastos y plan de la plata.
 *
 * El registro tiene que ser más rápido que no registrar: monto, categoría y
 * listo. Todo lo demás (detalle, medio de pago, "¿era necesario?") tiene un
 * valor por defecto razonable.
 */

const MISSING_MIGRATION = 'Falta correr la migración 021 en Supabase (supabase/migrations/021_daily_expenses_money_plan.sql).'

function n(v: unknown, fallback = 0): number {
    const x = Number(v)
    return Number.isFinite(x) ? x : fallback
}

function money(x: number): string {
    return `$${Math.round(x).toLocaleString('es-AR')}`
}

function isMissingColumn(error: any): boolean {
    const msg = String(error?.message || '')
    return error?.code === '42703' || error?.code === 'PGRST204' || /occurred_on|payment_method|necessity|money_plan/.test(msg)
}

function toRecord(row: any): ExpenseRecord {
    return {
        id: row.id,
        date: row.occurred_on || getLocalDateStr(new Date(row.created_at)),
        amount: n(row.amount),
        type: row.type,
        category: row.category || 'Otros',
        description: row.description || '',
        payment_method: row.payment_method || null,
        necessity: row.necessity || null,
        is_recurring: !!row.is_recurring
    }
}

async function requireUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autorizado')
    return { supabase, user }
}

/** Movimientos de los últimos `days` días, ya con su fecha real. */
export async function getExpenseHistory(days = 100): Promise<ExpenseRecord[]> {
    const { supabase, user } = await requireUser()
    const since = shiftDate(getLocalDateStr(), -days)

    const byDate = await supabase
        .from('finances')
        .select('*')
        .eq('user_id', user.id)
        .gte('occurred_on', since)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })

    if (!byDate.error) return (byDate.data || []).map(toRecord)

    // Sin la migración 021 no existe occurred_on: se usa la fecha de carga.
    const byCreated = await supabase
        .from('finances')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', `${since}T00:00:00-03:00`)
        .order('created_at', { ascending: false })

    if (byCreated.error) throw byCreated.error
    return (byCreated.data || []).map(toRecord)
}

// ============================================================
// REGISTRO RÁPIDO
// ============================================================

export interface QuickEntryInput {
    kind: 'expense' | 'income'
    amount: number
    category: string
    description?: string
    date?: string
    payment_method?: PaymentMethod | null
    necessity?: Necessity | null
    /** Gasto fijo que se repite todos los meses (alquiler, internet...). */
    recurring?: boolean
}

export interface QuickEntryResult {
    todayTotal: number
    todayCount: number
}

export async function createQuickEntry(input: QuickEntryInput): Promise<ActionResult<QuickEntryResult>> {
    return runAction('createQuickEntry', async () => {
        const { supabase, user } = await requireUser()

        const amount = Math.round(n(input.amount) * 100) / 100
        if (!(amount > 0)) throw new Error('Poné un monto mayor a cero.')

        const today = getLocalDateStr()
        const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : today
        if (date > today) throw new Error('La fecha no puede ser futura.')

        const isIncome = input.kind === 'income'
        const category = isIncome ? (input.category || 'Ingreso') : getCategory(input.category).id
        const description = (input.description || '').trim() || category
        const method = PAYMENT_METHODS.some(p => p.id === input.payment_method) ? input.payment_method : null

        const { error } = await supabase.from('finances').insert({
            user_id: user.id,
            type: isIncome ? 'Income' : input.recurring ? 'Fixed_Expense' : 'Variable',
            description: description.slice(0, 200),
            amount,
            category,
            is_recurring: !isIncome && !!input.recurring,
            due_day: !isIncome && input.recurring ? Number(date.split('-')[2]) : null,
            month_year: date.slice(0, 7),
            occurred_on: date,
            payment_method: method,
            necessity: isIncome ? null : input.necessity || null
        })

        if (error) {
            if (isMissingColumn(error)) throw new Error(MISSING_MIGRATION)
            throw new Error(error.message)
        }

        revalidatePath('/finances')
        revalidatePath('/')

        const { data: todayRows } = await supabase
            .from('finances')
            .select('amount')
            .eq('user_id', user.id)
            .eq('type', 'Variable')
            .eq('occurred_on', today)

        return {
            todayTotal: (todayRows || []).reduce((s: number, r: any) => s + n(r.amount), 0),
            todayCount: (todayRows || []).length
        }
    })
}

export interface ExpenseTemplate {
    description: string
    category: string
    amount: number
    payment_method: string | null
    necessity: string | null
    uses: number
}

export interface QuickEntryContext {
    today: string
    todayTotal: number
    todayCount: number
    avgPerDay: number
    dailyTarget: number | null
    lastMethod: string | null
    templates: ExpenseTemplate[]
    categoryUsage: Record<string, number>
}

/** Lo que el modal de carga rápida necesita para que cargar sea un toque. */
export async function getQuickEntryContext(): Promise<ActionResult<QuickEntryContext>> {
    return runAction('getQuickEntryContext', async () => {
        const { supabase, user } = await requireUser()
        const today = getLocalDateStr()
        const records = await getExpenseHistory(60)

        const daily = records.filter(r => r.type === 'Variable' && !r.is_recurring)
        const todayRows = daily.filter(r => r.date === today)
        const last30 = summarize(records, shiftDate(today, -29), today)

        // Plantillas: lo que más se repite (mismo detalle + categoría).
        const map = new Map<string, ExpenseTemplate>()
        for (const r of daily) {
            const key = `${r.description.toLowerCase().trim()}|${r.category}`
            const cur = map.get(key)
            if (cur) {
                cur.uses += 1
            } else {
                // records viene ordenado del más nuevo al más viejo: el primero es el último monto usado.
                map.set(key, {
                    description: r.description,
                    category: r.category,
                    amount: r.amount,
                    payment_method: r.payment_method,
                    necessity: r.necessity,
                    uses: 1
                })
            }
        }
        const templates = Array.from(map.values())
            .sort((a, b) => b.uses - a.uses)
            .slice(0, 6)

        const categoryUsage: Record<string, number> = {}
        for (const r of daily) categoryUsage[r.category] = (categoryUsage[r.category] || 0) + 1

        let dailyTarget: number | null = null
        const { data: plan } = await supabase
            .from('money_plan')
            .select('daily_spend_target')
            .eq('user_id', user.id)
            .maybeSingle()
        if (plan?.daily_spend_target) dailyTarget = n(plan.daily_spend_target)

        return {
            today,
            todayTotal: todayRows.reduce((s, r) => s + r.amount, 0),
            todayCount: todayRows.length,
            avgPerDay: Math.round(last30.avgPerDay),
            dailyTarget,
            lastMethod: daily.find(r => r.payment_method)?.payment_method || null,
            templates,
            categoryUsage
        }
    })
}

// ============================================================
// PLAN DE LA PLATA
// ============================================================

export interface MoneyPlanRow {
    monthly_income: number | null
    buckets: BucketPlan | null
    risk_profile: 'conservador' | 'moderado' | 'agresivo'
    emergency_fund_current: number
    invested_current: number
    daily_spend_target: number | null
    last_spending_analysis: SpendingAnalysis | null
    last_spending_analysis_at: string | null
    last_investment_advice: InvestmentAdvice | null
    last_investment_advice_at: string | null
}

export async function getMoneyPlan(): Promise<MoneyPlanRow | null> {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
        .from('money_plan')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error || !data) return null

    return {
        monthly_income: data.monthly_income != null ? n(data.monthly_income) : null,
        buckets: normalizeBuckets(data.buckets),
        risk_profile: data.risk_profile || 'conservador',
        emergency_fund_current: n(data.emergency_fund_current),
        invested_current: n(data.invested_current),
        daily_spend_target: data.daily_spend_target != null ? n(data.daily_spend_target) : null,
        last_spending_analysis: data.last_spending_analysis || null,
        last_spending_analysis_at: data.last_spending_analysis_at || null,
        last_investment_advice: data.last_investment_advice || null,
        last_investment_advice_at: data.last_investment_advice_at || null
    }
}

export interface MoneyPlanInput {
    monthly_income?: number | null
    buckets?: BucketPlan
    risk_profile?: 'conservador' | 'moderado' | 'agresivo'
    emergency_fund_current?: number
    invested_current?: number
    daily_spend_target?: number | null
}

export async function saveMoneyPlan(input: MoneyPlanInput): Promise<ActionResult<true>> {
    return runAction('saveMoneyPlan', async () => {
        const { supabase, user } = await requireUser()
        const row: Record<string, unknown> = { user_id: user.id }

        if (input.monthly_income !== undefined) row.monthly_income = input.monthly_income
        if (input.buckets) {
            const total = input.buckets.reduce((s, b) => s + n(b.pct), 0)
            if (Math.round(total) !== 100) throw new Error(`Los porcentajes tienen que sumar 100% (hoy suman ${Math.round(total)}%).`)
            row.buckets = input.buckets
        }
        if (input.risk_profile) row.risk_profile = input.risk_profile
        if (input.emergency_fund_current !== undefined) row.emergency_fund_current = Math.max(n(input.emergency_fund_current), 0)
        if (input.invested_current !== undefined) row.invested_current = Math.max(n(input.invested_current), 0)
        if (input.daily_spend_target !== undefined) row.daily_spend_target = input.daily_spend_target

        const { error } = await supabase.from('money_plan').upsert(row, { onConflict: 'user_id' })
        if (error) throw new Error(isMissingColumn(error) || error.code === '42P01' ? MISSING_MIGRATION : error.message)

        revalidatePath('/finances')
        return true as const
    })
}

export interface PlanContext {
    inputs: PlanInputs
    recommendation: PlanRecommendation
    incomeSource: 'plan' | 'fuentes' | 'mes'
}

/** Arma los números que usa el recomendador con lo que ya está cargado. */
async function buildPlanContext(plan: MoneyPlanRow | null, records: ExpenseRecord[]): Promise<PlanContext> {
    const today = getLocalDateStr()
    const [overview, range] = await Promise.all([
        getDebtsOverview().catch(() => null),
        getIncomeRange().catch(() => ({ floor: 0, ceiling: 0, sources: 0 }))
    ])

    const last30 = records.filter(r => r.date >= shiftDate(today, -29) && r.date <= today)
    const incomeThisMonth = records
        .filter(r => r.type === 'Income' && r.date.slice(0, 7) === today.slice(0, 7))
        .reduce((s, r) => s + r.amount, 0)

    let monthlyIncome = 0
    let incomeSource: PlanContext['incomeSource'] = 'mes'
    if (plan?.monthly_income) {
        monthlyIncome = plan.monthly_income
        incomeSource = 'plan'
    } else if (range.floor > 0) {
        monthlyIncome = range.floor
        incomeSource = 'fuentes'
    } else {
        monthlyIncome = incomeThisMonth
    }

    // Esencial = lo marcado como necesario, o (si no se marcó) lo de categorías esenciales y los fijos.
    const essentialMonthly = last30
        .filter(r => r.type === 'Variable' || r.type === 'Fixed_Expense')
        .filter(r => {
            if (r.necessity) return r.necessity === 'necesario'
            return r.type === 'Fixed_Expense' || r.is_recurring || getCategory(r.category).group === 'esencial'
        })
        .reduce((s, r) => s + r.amount, 0)

    const open = overview?.debts.filter(d => d.remaining_amount > 0) || []
    const inputs: PlanInputs = {
        monthlyIncome,
        essentialMonthly,
        debtInstallments: overview?.totals.monthlyInstallments || 0,
        debtRemaining: overview?.totals.remaining || 0,
        maxDebtMonthlyRatePct: open.reduce((m, d) => Math.max(m, d.monthlyRatePct || 0), 0),
        emergencyFundCurrent: plan?.emergency_fund_current || 0
    }

    return { inputs, recommendation: recommendPlan(inputs), incomeSource }
}

export async function getPlanContext(): Promise<PlanContext | null> {
    try {
        const [plan, records] = await Promise.all([getMoneyPlan(), getExpenseHistory(40)])
        return await buildPlanContext(plan, records)
    } catch (e) {
        console.error('[getPlanContext]', e)
        return null
    }
}

// ============================================================
// ANALISTA DE GASTOS (IA)
// ============================================================

export interface SpendingAnalysis {
    headline: string
    diagnosis: string
    daily_target: number
    leaks: { title: string; category: string; monthly_amount: number; why: string; action: string; monthly_saving: number }[]
    swaps: { from: string; to: string; monthly_saving: number; effort: 'bajo' | 'medio' | 'alto' }[]
    rules: string[]
    quick_win: string
    total_potential_saving: number
}

function summaryForPrompt(label: string, s: SpendingSummary): string {
    const cats = s.byCategory.slice(0, 10)
        .map(c => `  - ${c.category}: ${money(c.total)} (${c.count} gastos, ticket promedio ${money(c.avgTicket)}, ${c.pct.toFixed(0)}%)`)
        .join('\n')
    const methods = s.byMethod.map(m => `${m.method} ${money(m.total)}`).join(' · ')
    const nec = s.byNecessity
    const weekdays = s.byWeekday.map(w => `${w.label} ${money(w.avg)}`).join(' · ')
    const hormiga = s.hormiga
        .map(h => `  - "${h.label}" (${h.category}): ${h.count} veces, ${money(h.total)} en el período → ~${money(h.monthly)}/mes, ~${money(h.yearly)}/año`)
        .join('\n')
    const expensive = s.expensiveDays.map(d => `${d.date} ${money(d.total)} (lo más grande: ${d.topItem})`).join(' · ')

    return `
${label} (${s.from} a ${s.to}, ${s.days} días):
- Gasto total (sin pagos de deuda): ${money(s.total)} · fijos ${money(s.fixedTotal)} · día a día ${money(s.dailyTotal)}
- Promedio diario del día a día: ${money(s.avgPerDay)} · día típico (mediana): ${money(s.medianDay)} · ticket típico: ${money(s.typicalTicket)}
- Días sin gastar: ${s.noSpendDays} de ${s.days}
- Por categoría:
${cats || '  (sin datos)'}
- Medio de pago: ${methods || 'sin datos'}
- ¿Era necesario?: necesario ${money(nec.necesario)} · gusto ${money(nec.gusto)} · impulso ${money(nec.impulso)} · sin marcar ${money(nec.sin_dato)}
- Promedio por día de la semana: ${weekdays}
- Gastos hormiga detectados:
${hormiga || '  (ninguno todavía)'}
- Días caros: ${expensive || 'ninguno destacado'}`.trim()
}

export async function analyzeSpending(): Promise<ActionResult<SpendingAnalysis>> {
    return runAction('analyzeSpending', async () => {
        const { supabase, user } = await requireUser()
        const today = getLocalDateStr()
        const [records, plan] = await Promise.all([getExpenseHistory(70), getMoneyPlan()])

        const range = rangeFor('30d', today)
        const current = summarize(records, range.from, range.to)
        if (current.count < 5) {
            throw new Error('Todavía hay pocos gastos registrados. Con 5 o más el análisis empieza a servir (con 2 semanas, mucho mejor).')
        }
        const prevRange = previousRange(range)
        const previous = summarize(records, prevRange.from, prevRange.to)
        const deltas = compareCategories(current, previous)
            .filter(d => d.previous > 0 && Math.abs(d.deltaMonthly) > 0)
            .slice(0, 6)
            .map(d => `${d.category}: ${d.deltaMonthly >= 0 ? '+' : ''}${money(d.deltaMonthly)}/mes`)
            .join(' · ')

        const ctx = await buildPlanContext(plan, records)
        const overview = await getDebtsOverview().catch(() => null)

        const prompt = `
Sos el analista de gastos personal del usuario. Vive en Tucumán, Argentina; todo en pesos argentinos. Hoy es ${today}.
Tiene deudas y quiere entender en qué se le va la plata, cuánto gasta por día y qué gastos de más tiene, para recortar sin vivir peor.

INGRESO MENSUAL DE REFERENCIA: ${ctx.inputs.monthlyIncome > 0 ? money(ctx.inputs.monthlyIncome) : 'no cargado'}
DEUDA: ${overview ? `${money(overview.totals.remaining)} en total · le cuesta ${money(overview.totals.dailyCost)} por día de interés · cuotas ${money(overview.totals.monthlyInstallments)}/mes` : 'sin datos'}

${summaryForPrompt('ÚLTIMOS 30 DÍAS', current)}

${previous.count > 0 ? `PERÍODO ANTERIOR: gasto total ${money(previous.total)}, promedio diario ${money(previous.avgPerDay)}.
Cambios por categoría (llevados a 30 días): ${deltas || 'sin cambios relevantes'}` : 'No hay datos del período anterior.'}

Tu trabajo:
1. "leaks": las 2 a 4 fugas más grandes y concretas (categoría o gasto puntual). Para cada una: cuánto se va por mes, por qué es una fuga (frecuencia, ticket, impulso, comisión) y una acción ESPECÍFICA (no "gastá menos"). "monthly_saving" realista, no el total de la categoría.
2. "swaps": 2 a 5 reemplazos concretos y realistas para Argentina ("delivery 3 veces por semana" → "cocinar de más el domingo y congelar", "Uber" → "SUBE + Uber solo de noche", "comprar en el chino" → "compra mayorista quincenal", pagar en efectivo para descuentos, promos bancarias por día, etc.). Con ahorro mensual estimado y esfuerzo.
3. "rules": 2 a 4 reglas personales cortas basadas en SUS patrones (ej: "los viernes salís con un tope de $X en efectivo", "compras de más de $X: esperar 24 h").
4. "daily_target": un tope diario realista para el día a día (redondeado a 500), que baje su promedio actual sin ser imposible.
5. "quick_win": UNA cosa para hacer esta semana que ahorre plata ya.
6. Si hay gastos sin marcar o pocos datos, decilo en el diagnóstico en una frase.

Tono: español rioplatense con voseo, directo, cálido, sin moralina. Números concretos sacados de los datos. No inventes gastos que no aparecen.

Respondé SOLO con este JSON:
{
  "headline": "una frase con un número real",
  "diagnosis": "2 o 3 frases",
  "daily_target": 15000,
  "leaks": [ { "title": "...", "category": "...", "monthly_amount": 0, "why": "...", "action": "...", "monthly_saving": 0 } ],
  "swaps": [ { "from": "...", "to": "...", "monthly_saving": 0, "effort": "bajo" } ],
  "rules": ["..."],
  "quick_win": "...",
  "total_potential_saving": 0
}`.trim()

        const text = await generateText(prompt, { temperature: 0.5, maxOutputTokens: 2600, json: true })
        const parsed = parseJSON<any>(text)

        const leaks = (Array.isArray(parsed.leaks) ? parsed.leaks : []).slice(0, 5).map((l: any) => ({
            title: String(l?.title || ''),
            category: String(l?.category || ''),
            monthly_amount: Math.max(Math.round(n(l?.monthly_amount)), 0),
            why: String(l?.why || ''),
            action: String(l?.action || ''),
            monthly_saving: Math.max(Math.round(n(l?.monthly_saving)), 0)
        })).filter((l: any) => l.title)

        const swaps = (Array.isArray(parsed.swaps) ? parsed.swaps : []).slice(0, 6).map((s: any) => ({
            from: String(s?.from || ''),
            to: String(s?.to || ''),
            monthly_saving: Math.max(Math.round(n(s?.monthly_saving)), 0),
            effort: (['bajo', 'medio', 'alto'].includes(s?.effort) ? s.effort : 'medio') as 'bajo' | 'medio' | 'alto'
        })).filter((s: any) => s.from && s.to)

        const sumSavings = leaks.reduce((s: number, l: any) => s + l.monthly_saving, 0)
        const analysis: SpendingAnalysis = {
            headline: String(parsed.headline || ''),
            diagnosis: String(parsed.diagnosis || ''),
            daily_target: Math.max(Math.round(n(parsed.daily_target) / 500) * 500, 0),
            leaks,
            swaps,
            rules: Array.isArray(parsed.rules) ? parsed.rules.filter(Boolean).map(String).slice(0, 5) : [],
            quick_win: String(parsed.quick_win || ''),
            total_potential_saving: Math.max(Math.round(n(parsed.total_potential_saving)), sumSavings)
        }

        // Se guarda para no pedirle a la IA lo mismo cada vez que se abre la pantalla.
        await supabase.from('money_plan').upsert({
            user_id: user.id,
            last_spending_analysis: analysis,
            last_spending_analysis_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

        return analysis
    })
}

// ============================================================
// ASESOR DE INVERSIÓN (IA)
// ============================================================

export interface InvestmentAdvice {
    headline: string
    phase_explanation: string
    debt_vs_invest: string
    where_to_put: { bucket: string; instrument: string; amount: number; why: string }[]
    first_steps: string[]
    passive_income_reality: string
    income_ideas: string[]
    warnings: string[]
}

export async function getInvestmentAdvice(): Promise<ActionResult<InvestmentAdvice>> {
    return runAction('getInvestmentAdvice', async () => {
        const { supabase, user } = await requireUser()
        const today = getLocalDateStr()
        const [plan, records, overview] = await Promise.all([
            getMoneyPlan(),
            getExpenseHistory(40),
            getDebtsOverview().catch(() => null)
        ])
        const ctx = await buildPlanContext(plan, records)
        const income = ctx.inputs.monthlyIncome
        if (!(income > 0)) {
            throw new Error('Cargá tu ingreso mensual (arriba, en "Tu ingreso") para que el asesor pueda armar el reparto.')
        }

        const buckets = plan?.buckets || ctx.recommendation.buckets
        const bucketLines = buckets.map(b => {
            const def = BUCKETS.find(x => x.id === b.id)!
            return `- ${def.label}: ${b.pct}% = ${money((income * b.pct) / 100)}/mes`
        }).join('\n')

        const debtLines = (overview?.debts || [])
            .filter(d => d.remaining_amount > 0)
            .map(d => `- ${d.creditor} (${d.kind}): saldo ${money(d.remaining_amount)}, ${d.rateSource === 'sin_datos' ? 'tasa desconocida' : `~${d.monthlyRatePct.toFixed(1)}%/mes`}${d.plan_active ? `, en plan de cuotas (${d.installmentsLeft} restantes)` : ''}`)
            .join('\n')

        const catalog = INVESTMENT_OPTIONS
            .map(o => `- ${o.name} [${o.currency}, riesgo ${o.risk}/5, liquidez ${o.liquidity}]: ${o.goodFor}`)
            .join('\n')

        const prompt = `
Sos un asesor financiero personal, práctico y honesto. El usuario vive en Tucumán, Argentina, cobra en pesos y tiene deudas. Hoy es ${today}.
Quiere empezar a destinar una parte de su sueldo (5-10%) a invertir para generar ingresos pasivos, sin descuidar las deudas.

INGRESO MENSUAL: ${money(income)}
GASTO ESENCIAL (últimos 30 días): ${money(ctx.inputs.essentialMonthly)}
ETAPA DETECTADA: ${PHASE_INFO[ctx.recommendation.phase].label} — ${PHASE_INFO[ctx.recommendation.phase].summary}
PERFIL DE RIESGO: ${plan?.risk_profile || 'conservador'}
FONDO DE EMERGENCIA ACTUAL: ${money(plan?.emergency_fund_current || 0)} (meta: ${money(ctx.recommendation.emergencyTarget)})
YA INVERTIDO: ${money(plan?.invested_current || 0)}

REPARTO ELEGIDO:
${bucketLines}

DEUDAS:
${debtLines || '- no tiene deudas cargadas'}
Interés diario total: ${money(overview?.totals.dailyCost || 0)}

OPCIONES DISPONIBLES EN ARGENTINA:
${catalog}

Tu trabajo:
1. "debt_vs_invest": compará con números la tasa de su deuda más cara contra lo que puede rendir invertir. Si la deuda es cara, decí claramente que pagarla es la mejor "inversión", pero justificá igual el % chico de inversión como hábito.
2. "where_to_put": para Fondo de emergencia e Inversión (y si aplica, la parte en dólares), qué instrumento concreto de la lista usar y cuánto por mes en pesos. Montos chicos → instrumentos simples (money market, cuenta remunerada); recién con más monto, ONs o CEDEARs de ETFs.
3. "first_steps": 3 a 5 pasos concretos para este mes (ej: "el día que cobrás, transferí $X a ..."; "abrí cuenta en una ALyC"; "activá débito automático"). El primero tiene que poder hacerse hoy.
4. "passive_income_reality": con su monto mensual, qué ingreso pasivo es realista a 1, 5 y 10 años (usá ~4% de retiro anual sobre el capital, rendimiento real 3-6% anual en dólares). Sin vender humo.
5. "income_ideas": 2 o 3 formas de subir el ingreso activo con lo que se intuye de su perfil (sin inventar datos), porque con poco capital es la palanca más grande.
6. "warnings": riesgos concretos (ej: no meter el colchón en algo volátil, no comprar cripto/acciones sueltas por moda, cuidado con comisiones en montos chicos). No es asesoramiento regulado: recomendá verificar tasas del día.

Tono: español rioplatense con voseo, directo, sin moralina, sin jerga innecesaria (si usás una sigla, explicala en 3 palabras).

Respondé SOLO con este JSON:
{
  "headline": "una frase con un número real",
  "phase_explanation": "2 frases",
  "debt_vs_invest": "...",
  "where_to_put": [ { "bucket": "Fondo de emergencia", "instrument": "...", "amount": 0, "why": "..." } ],
  "first_steps": ["..."],
  "passive_income_reality": "...",
  "income_ideas": ["..."],
  "warnings": ["..."]
}`.trim()

        const text = await generateText(prompt, { temperature: 0.5, maxOutputTokens: 2600, json: true })
        const parsed = parseJSON<any>(text)

        const list = (v: unknown, max = 6) => (Array.isArray(v) ? v.filter(Boolean).map(String).slice(0, max) : [])

        const advice: InvestmentAdvice = {
            headline: String(parsed.headline || ''),
            phase_explanation: String(parsed.phase_explanation || ''),
            debt_vs_invest: String(parsed.debt_vs_invest || ''),
            where_to_put: (Array.isArray(parsed.where_to_put) ? parsed.where_to_put : []).slice(0, 6).map((w: any) => ({
                bucket: String(w?.bucket || ''),
                instrument: String(w?.instrument || ''),
                amount: Math.max(Math.round(n(w?.amount)), 0),
                why: String(w?.why || '')
            })).filter((w: any) => w.instrument),
            first_steps: list(parsed.first_steps),
            passive_income_reality: String(parsed.passive_income_reality || ''),
            income_ideas: list(parsed.income_ideas, 4),
            warnings: list(parsed.warnings, 5)
        }

        await supabase.from('money_plan').upsert({
            user_id: user.id,
            last_investment_advice: advice,
            last_investment_advice_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

        return advice
    })
}
