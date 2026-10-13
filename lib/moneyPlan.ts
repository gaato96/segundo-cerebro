/**
 * Plan de la plata: cómo repartir el ingreso y dónde poner lo que se ahorra.
 *
 * El reparto recomendado sale de reglas, no de la IA, para que sea estable y
 * explicable: depende de cuánto se va en lo esencial, de cuánto cuesta la deuda
 * más cara y de si ya hay un colchón. La IA (lib/actions/expenses.ts) lo
 * personaliza encima, pero la pantalla funciona sin ella.
 */

export type BucketId = 'necesidades' | 'deudas' | 'colchon' | 'inversion' | 'gustos'

export interface BucketDef {
    id: BucketId
    label: string
    emoji: string
    color: string
    description: string
}

export const BUCKETS: BucketDef[] = [
    { id: 'necesidades', label: 'Necesidades', emoji: '🏠', color: '#6366f1', description: 'Vivienda, súper, servicios, transporte, Julián, salud.' },
    { id: 'deudas', label: 'Deudas', emoji: '💳', color: '#ef4444', description: 'Cuotas de planes + todo lo extra para matar la deuda más cara.' },
    { id: 'colchon', label: 'Fondo de emergencia', emoji: '🛟', color: '#10b981', description: 'Para que un imprevisto no se convierta en deuda nueva.' },
    { id: 'inversion', label: 'Inversión', emoji: '📈', color: '#f59e0b', description: 'Plata que trabaja para vos a largo plazo (ingresos pasivos).' },
    { id: 'gustos', label: 'Gustos y vida', emoji: '🎉', color: '#a855f7', description: 'Salidas, delivery, caprichos. Sin culpa, pero con techo.' }
]

export type BucketPlan = { id: BucketId; pct: number }[]

export type Phase = 'supervivencia' | 'deuda_cara' | 'deuda_barata' | 'colchon' | 'crecer'

export const PHASE_INFO: Record<Phase, { label: string; summary: string }> = {
    supervivencia: {
        label: 'Apagar el incendio',
        summary: 'Lo esencial y las cuotas se comen casi todo el ingreso. Antes de invertir hay que abrir margen: recortar o subir ingresos.'
    },
    deuda_cara: {
        label: 'Matar la deuda cara',
        summary: 'Tenés deuda que cobra más de lo que cualquier inversión segura te va a dar. Cada peso que le sacás a esa deuda "rinde" su tasa, garantizado.'
    },
    deuda_barata: {
        label: 'Deuda bajo control',
        summary: 'Tus deudas son cuotas fijas o de tasa baja: la inflación las licúa. Podés pagarlas al día y en paralelo empezar a construir.'
    },
    colchon: {
        label: 'Armar el colchón',
        summary: 'Sin deudas, pero sin respaldo. Lo primero es juntar 3 meses de gastos esenciales en algo líquido.'
    },
    crecer: {
        label: 'Hacer crecer la plata',
        summary: 'Sin deudas y con colchón. Ahora la prioridad es invertir todos los meses, siempre el mismo porcentaje.'
    }
}

export interface PlanInputs {
    monthlyIncome: number
    /** Gasto mensual esencial (necesario + fijos). */
    essentialMonthly: number
    /** Cuotas ya comprometidas por mes. */
    debtInstallments: number
    debtRemaining: number
    /** La tasa mensual de la deuda más cara (en %). */
    maxDebtMonthlyRatePct: number
    emergencyFundCurrent: number
}

export interface PlanRecommendation {
    phase: Phase
    buckets: BucketPlan
    reasons: string[]
    emergencyTarget: number
}

/** Tasa mensual a partir de la cual una deuda es "cara" (le gana a invertir seguro). */
export const EXPENSIVE_DEBT_MONTHLY_PCT = 3

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi)

export function recommendPlan(input: PlanInputs): PlanRecommendation {
    const income = Math.max(input.monthlyIncome, 0)
    const reasons: string[] = []
    const emergencyTarget = Math.round(Math.max(input.essentialMonthly, income * 0.5) * 3)

    const essentialPct = income > 0 ? (input.essentialMonthly / income) * 100 : 50
    const installmentsPct = income > 0 ? (input.debtInstallments / income) * 100 : 0
    const hasDebt = input.debtRemaining > 0

    let phase: Phase
    // Sin ingreso cargado no se puede saber si hay incendio: se decide solo por deudas y colchón.
    if (income > 0 && essentialPct + installmentsPct >= 92) phase = 'supervivencia'
    else if (hasDebt && input.maxDebtMonthlyRatePct >= EXPENSIVE_DEBT_MONTHLY_PCT) phase = 'deuda_cara'
    else if (hasDebt) phase = 'deuda_barata'
    else if (emergencyTarget === 0 || input.emergencyFundCurrent < emergencyTarget) phase = 'colchon'
    else phase = 'crecer'

    // Lo esencial manda: se respeta lo que realmente gastás, con un piso y un techo.
    const needs = Math.round(clamp(essentialPct || 50, 35, phase === 'supervivencia' ? 90 : 75))
    reasons.push(input.essentialMonthly > 0
        ? `Lo esencial te lleva hoy ~${Math.round(essentialPct)}% del ingreso, por eso Necesidades queda en ${needs}%.`
        : 'Todavía no hay registro de gastos esenciales: arranqué con 50% para Necesidades. Registrá tus gastos un mes y se ajusta solo.')

    // Lo que se le pide a cada destino según la etapa, antes de ver si entra.
    const asks: Record<Phase, { colchon: number; inversion: number; gustos: number }> = {
        supervivencia: { colchon: 3, inversion: 2, gustos: 3 },
        deuda_cara: { colchon: 5, inversion: 5, gustos: 7 },
        deuda_barata: { colchon: 10, inversion: 10, gustos: 10 },
        colchon: { colchon: 15, inversion: 10, gustos: 10 },
        crecer: { colchon: 5, inversion: 20, gustos: 15 }
    }
    const ask = { ...asks[phase] }

    const free = 100 - needs
    const minDebt = hasDebt ? Math.ceil(installmentsPct) : 0

    // Si no entra todo, se recorta en este orden: gustos, colchón, inversión.
    const wanted = () => ask.colchon + ask.inversion + ask.gustos + minDebt
    for (const key of ['gustos', 'colchon', 'inversion'] as const) {
        while (wanted() > free && ask[key] > (key === 'inversion' ? 1 : 0)) ask[key] -= 1
    }

    const deudas = hasDebt ? Math.max(free - ask.colchon - ask.inversion - ask.gustos, 0) : 0
    if (!hasDebt) {
        // Sin deuda, lo que sobra va a colchón o a inversión según la etapa.
        const rest = Math.max(free - ask.colchon - ask.inversion - ask.gustos, 0)
        if (phase === 'crecer') {
            ask.inversion += rest
        } else if (phase === 'colchon') {
            const toInvest = Math.round(rest * 0.3)
            ask.inversion += toInvest
            ask.colchon += rest - toInvest
        } else {
            ask.colchon += rest
        }
    }

    if (phase === 'deuda_cara') {
        reasons.push(`Tu deuda más cara cuesta ~${input.maxDebtMonthlyRatePct.toFixed(1)}% por mes. Ninguna inversión segura rinde eso: el grueso del margen (${deudas}%) va a deuda.`)
        reasons.push(`Igual dejo ${ask.inversion}% para inversión: no por lo que rinde, sino para que el hábito de invertir arranque hoy y no "cuando termine de pagar".`)
    } else if (phase === 'deuda_barata') {
        reasons.push('Tus deudas no corren a tasa alta: alcanza con pagarlas al día. Podés invertir en paralelo sin culpa.')
    } else if (phase === 'supervivencia') {
        reasons.push('Hoy no hay margen real. La inversión queda simbólica (para sostener el hábito) y la prioridad es recortar gastos o sumar ingresos.')
    } else if (phase === 'colchon') {
        reasons.push(`Primero el colchón: la meta son ~3 meses de esenciales ($${emergencyTarget.toLocaleString('es-AR')}).`)
    } else {
        reasons.push('Con colchón armado y sin deudas, el foco pasa a invertir todos los meses el mismo porcentaje.')
    }

    if (income <= 0) {
        reasons.unshift('No hay ingreso cargado: este reparto es orientativo. Poné tu ingreso mensual arriba para que los montos sean reales.')
    }

    if (hasDebt && minDebt > 0) {
        reasons.push(`Las cuotas ya comprometidas son ~${minDebt}% del ingreso: Deudas nunca baja de eso.`)
    }

    // Que sume 100 exacto (el redondeo puede dejar ±1).
    const buckets: BucketPlan = [
        { id: 'necesidades', pct: needs },
        { id: 'deudas', pct: deudas },
        { id: 'colchon', pct: ask.colchon },
        { id: 'inversion', pct: ask.inversion },
        { id: 'gustos', pct: ask.gustos }
    ]
    const sum = buckets.reduce((s, b) => s + b.pct, 0)
    if (sum !== 100) {
        const target = buckets.find(b => b.id === (hasDebt ? 'deudas' : phase === 'crecer' ? 'inversion' : 'colchon'))!
        target.pct = Math.max(target.pct + (100 - sum), 0)
    }

    return { phase, buckets, reasons, emergencyTarget }
}

/** Normaliza lo guardado en la base (puede faltar algún destino). */
export function normalizeBuckets(raw: unknown): BucketPlan | null {
    if (!Array.isArray(raw)) return null
    const plan = BUCKETS.map(b => {
        const found = (raw as any[]).find(r => r?.id === b.id)
        return { id: b.id, pct: Math.max(Math.round(Number(found?.pct) || 0), 0) }
    })
    return plan.some(p => p.pct > 0) ? plan : null
}

// ============================================================
// INTERÉS COMPUESTO: cuánto puede llegar a ser
// ============================================================

/**
 * Capital acumulado aportando `monthly` todos los meses durante `years`, con un
 * rendimiento REAL anual (ya descontada la inflación). El resultado está en
 * "pesos de hoy": sirve para dimensionar, no es una promesa.
 */
export function futureValue(monthly: number, years: number, realAnnualPct: number): number {
    const r = Math.pow(1 + realAnnualPct / 100, 1 / 12) - 1
    const n = Math.round(years * 12)
    if (r === 0) return monthly * n
    return monthly * ((Math.pow(1 + r, n) - 1) / r)
}

/** Ingreso pasivo mensual sostenible de un capital (regla del 4% anual). */
export function passiveIncome(capital: number): number {
    return (capital * 0.04) / 12
}

// ============================================================
// DÓNDE PONER LA PLATA (Argentina)
// ============================================================

export interface InvestmentOption {
    id: string
    name: string
    bucket: 'colchon' | 'inversion' | 'ambos'
    risk: 1 | 2 | 3 | 4 | 5
    liquidity: string
    horizon: string
    currency: 'ARS' | 'USD' | 'ARS/USD'
    what: string
    goodFor: string
    watchOut: string
    where: string
}

export const INVESTMENT_OPTIONS: InvestmentOption[] = [
    {
        id: 'cuenta_remunerada',
        name: 'Cuenta remunerada / billetera',
        bucket: 'colchon',
        risk: 1,
        liquidity: 'Inmediata',
        horizon: 'Días a meses',
        currency: 'ARS',
        what: 'La plata rinde todos los días y la podés usar cuando quieras.',
        goodFor: 'El fondo de emergencia y la plata del mes. Mejor que dejarla quieta en la caja de ahorro.',
        watchOut: 'Suele rendir cerca o por debajo de la inflación: es para no perder, no para ganar.',
        where: 'Mercado Pago, Ualá, Naranja X, Brubank, cuentas remuneradas de bancos.'
    },
    {
        id: 'money_market',
        name: 'FCI Money Market',
        bucket: 'colchon',
        risk: 1,
        liquidity: 'Inmediata o 24 h',
        horizon: 'Días a meses',
        currency: 'ARS',
        what: 'Fondo común que invierte en plazos fijos y cauciones de muy corto plazo.',
        goodFor: 'Colchón y "estacionar" plata mientras decidís. Ideal para arrancar con montos chicos.',
        watchOut: 'No está garantizado como un plazo fijo, aunque el riesgo es muy bajo.',
        where: 'Tu banco o cualquier ALyC (IOL, Balanz, Cocos, Bull Market, PPI).'
    },
    {
        id: 'plazo_fijo',
        name: 'Plazo fijo (tradicional o UVA)',
        bucket: 'colchon',
        risk: 1,
        liquidity: '30 días (UVA: más largo)',
        horizon: '1 a 6 meses',
        currency: 'ARS',
        what: 'Tasa fija por 30 días, o UVA: ajusta por inflación más una tasa.',
        goodFor: 'La parte del colchón que no vas a tocar en 1 a 3 meses. El UVA te cubre de la inflación.',
        watchOut: 'La plata queda bloqueada hasta el vencimiento. Compará la tasa contra la inflación esperada.',
        where: 'Home banking de cualquier banco.'
    },
    {
        id: 'cauciones_lecaps',
        name: 'Cauciones y Letras del Tesoro (LECAPs)',
        bucket: 'ambos',
        risk: 2,
        liquidity: '1 a 30 días / venta en el mercado',
        horizon: '1 a 12 meses',
        currency: 'ARS',
        what: 'Préstamos de corto plazo garantizados por el mercado (cauciones) o letras en pesos a tasa fija.',
        goodFor: 'Ganarle a la billetera con plata que no necesitás este mes.',
        watchOut: 'Hay que operar desde un broker y mirar comisiones: con montos muy chicos se comen la ganancia.',
        where: 'Cualquier ALyC registrada en la CNV.'
    },
    {
        id: 'bonos_cer',
        name: 'Bonos que ajustan por inflación (CER)',
        bucket: 'inversion',
        risk: 2,
        liquidity: 'Venta en el mercado (24 h)',
        horizon: '6 meses a 3 años',
        currency: 'ARS',
        what: 'Bonos del Tesoro cuyo capital se actualiza con la inflación.',
        goodFor: 'Proteger pesos contra la inflación a mediano plazo.',
        watchOut: 'Si los vendés antes del vencimiento, el precio puede haber bajado.',
        where: 'ALyC (IOL, Balanz, Cocos, Bull Market, PPI).'
    },
    {
        id: 'dolar_mep',
        name: 'Dólar MEP',
        bucket: 'ambos',
        risk: 2,
        liquidity: 'Inmediata',
        horizon: 'Cualquiera',
        currency: 'USD',
        what: 'Comprar dólares legales a través de bonos, desde tu banco o broker.',
        goodFor: 'Cubrirte de una devaluación y ahorrar en moneda dura. Paso previo para invertir en dólares.',
        watchOut: 'El dólar quieto no rinde: es cobertura, no inversión. Conviene ponerlo a trabajar (ONs, ETFs).',
        where: 'Home banking o ALyC.'
    },
    {
        id: 'ons',
        name: 'Obligaciones Negociables (ONs) en dólares',
        bucket: 'inversion',
        risk: 3,
        liquidity: 'Venta en el mercado',
        horizon: '1 a 5 años',
        currency: 'USD',
        what: 'Le prestás a una empresa grande y te paga intereses (cupones) en dólares cada 3 o 6 meses.',
        goodFor: 'Lo más parecido a un ingreso pasivo real: renta periódica en dólares.',
        watchOut: 'Riesgo de la empresa. Diversificá en varias y elegí emisores sólidos.',
        where: 'ALyC. Los mínimos suelen ser bajos (desde 1 lámina).'
    },
    {
        id: 'cedears_etf',
        name: 'CEDEARs de ETFs (índices globales)',
        bucket: 'inversion',
        risk: 4,
        liquidity: 'Venta en el mercado (24 h)',
        horizon: '5 años o más',
        currency: 'ARS/USD',
        what: 'Comprás en pesos un pedacito de un fondo que replica, por ejemplo, el S&P 500 (las 500 empresas más grandes de EE. UU.).',
        goodFor: 'Hacer crecer la plata a largo plazo. Comprar todos los meses el mismo monto, sin mirar el precio.',
        watchOut: 'Puede caer 20-30% en un mal año. Solo plata que no vas a necesitar en 5 años.',
        where: 'ALyC. Se puede arrancar con montos chicos.'
    },
    {
        id: 'vos',
        name: 'Invertir en vos (subir tu ingreso)',
        bucket: 'inversion',
        risk: 2,
        liquidity: '—',
        horizon: '3 a 12 meses',
        currency: 'ARS',
        what: 'Un curso, una herramienta o un equipo que te permita cobrar más o conseguir más clientes.',
        goodFor: 'Con poco capital, es la inversión que más rinde: un cliente más por mes le gana a cualquier tasa.',
        watchOut: 'Solo cuenta si tiene un plan concreto de cómo se convierte en plata.',
        where: 'Depende de tu trabajo: definilo con el copiloto.'
    }
]
