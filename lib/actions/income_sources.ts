'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocalMonthYearStr } from '@/lib/utils'

/**
 * Fuentes de ingreso.
 *
 * "Un solo ingreso fijo que no cubre los gastos, más trabajos que pueden salir
 * o no, más cobros en 2/3/4 pagos, más recurrentes." Un único número de
 * "ingreso mensual" no representa nada de eso: acá cada tipo se modela aparte
 * y el sistema puede razonar con un piso y un techo en vez de un promedio.
 */

export type IncomeKind = 'fixed' | 'variable' | 'installments' | 'recurring'
export type IncomeConfidence = 'confirmada' | 'probable' | 'incierta'

export interface IncomeSourceItem {
    id: string
    user_id: string
    name: string
    kind: IncomeKind
    amount: number
    client: string | null
    confidence: IncomeConfidence
    expected_day: number | null
    installments_total: number | null
    installments_paid: number
    frequency_months: number
    start_date: string | null
    end_date: string | null
    is_active: boolean
    notes: string | null
    created_at: string
}

export async function getIncomeSources(includeInactive = false): Promise<IncomeSourceItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .order('kind', { ascending: true })
        .order('amount', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) {
        console.error('Error fetching income sources:', error)
        return []
    }
    return (data || []) as IncomeSourceItem[]
}

export interface IncomeSourceInput {
    id?: string
    name: string
    kind: IncomeKind
    amount: number
    client?: string | null
    confidence?: IncomeConfidence
    expected_day?: number | null
    installments_total?: number | null
    installments_paid?: number
    frequency_months?: number
    notes?: string | null
    is_active?: boolean
}

export async function saveIncomeSource(input: IncomeSourceInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (!input.name?.trim()) return { error: 'Ponele un nombre a la fuente de ingreso.' }
    if (!(input.amount >= 0)) return { error: 'El monto no puede ser negativo.' }

    const payload = {
        user_id: user.id,
        name: input.name.trim(),
        kind: input.kind,
        amount: input.amount,
        client: input.client || null,
        // Un ingreso variable nunca es "confirmado": esa es toda la gracia.
        confidence: input.kind === 'variable' && input.confidence === 'confirmada'
            ? 'probable'
            : (input.confidence || 'confirmada'),
        expected_day: input.expected_day ?? null,
        installments_total: input.kind === 'installments' ? (input.installments_total ?? null) : null,
        installments_paid: input.installments_paid ?? 0,
        frequency_months: Math.max(input.frequency_months ?? 1, 1),
        notes: input.notes || null,
        is_active: input.is_active ?? true
    }

    const { error } = input.id
        ? await supabase.from('income_sources').update(payload).eq('id', input.id).eq('user_id', user.id)
        : await supabase.from('income_sources').insert(payload)

    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

export async function deleteIncomeSource(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase.from('income_sources').delete().eq('id', id).eq('user_id', user.id)
    if (error) return { error: error.message }

    revalidatePath('/finances')
    return { success: true }
}

/**
 * Registra que cobraste: suma el movimiento al mes y, si es un cobro en cuotas,
 * avanza el contador (y lo desactiva cuando se terminó).
 */
export async function registerIncomeReceived(sourceId: string, amount?: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: source } = await supabase
        .from('income_sources')
        .select('*')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!source) return { error: 'Esa fuente de ingreso ya no existe.' }

    const value = amount ?? Number(source.amount)
    if (!(value > 0)) return { error: 'El monto tiene que ser mayor a cero.' }

    const installmentLabel = source.kind === 'installments' && source.installments_total
        ? ` (pago ${Number(source.installments_paid) + 1}/${source.installments_total})`
        : ''

    const { error: txError } = await supabase.from('finances').insert({
        user_id: user.id,
        type: 'Income',
        description: `${source.name}${installmentLabel}`,
        amount: value,
        category: source.client || 'Ingresos',
        income_source_id: sourceId,
        month_year: getLocalMonthYearStr()
    })

    if (txError) return { error: txError.message }

    if (source.kind === 'installments' && source.installments_total) {
        const paid = Number(source.installments_paid) + 1
        await supabase
            .from('income_sources')
            .update({
                installments_paid: paid,
                is_active: paid < Number(source.installments_total)
            })
            .eq('id', sourceId)
            .eq('user_id', user.id)
    }

    revalidatePath('/finances')
    revalidatePath('/')
    return { success: true, amount: value }
}
