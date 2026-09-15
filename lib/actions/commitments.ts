'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { addDaysToDateStr } from '@/lib/utils'
import { getAppToday } from '@/lib/actions/day'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { runAction, type ActionResult } from '@/lib/actionResult'

/**
 * "Compromiso de mañana": una sola acción no negociable, firmada la noche anterior,
 * con hora, lugar, versión de 2 minutos y plan si-entonces.
 *
 * La idea: el problema no es la motivación de la noche, es que a la mañana
 * la decisión sigue abierta. Esto la cierra por adelantado.
 */

export interface CommitmentInput {
    date: string
    action: string
    scheduled_time?: string | null
    location?: string | null
    two_minute_version?: string | null
    identity_why?: string | null
    obstacle?: string | null
    if_then_plan?: string | null
}

export async function getCommitment(date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('daily_commitments')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function getTodayCommitment() {
    return getCommitment(await getAppToday())
}

export async function getCommitmentHistory(days = 30) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const from = addDaysToDateStr(await getAppToday(), -days)

    const { data, error } = await supabase
        .from('daily_commitments')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', from)
        .order('date', { ascending: false })

    if (error) throw error
    return data || []
}

export async function saveCommitment(input: CommitmentInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    if (!input.action?.trim()) throw new Error('Escribí la acción que te vas a comprometer a hacer.')

    const { data, error } = await supabase
        .from('daily_commitments')
        .upsert({
            user_id: user.id,
            date: input.date,
            action: input.action.trim(),
            scheduled_time: input.scheduled_time || null,
            location: input.location || null,
            two_minute_version: input.two_minute_version || null,
            identity_why: input.identity_why || null,
            obstacle: input.obstacle || null,
            if_then_plan: input.if_then_plan || null
        }, { onConflict: 'user_id, date' })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/')
    revalidatePath('/ritual')
    revalidatePath('/asistente')
    return data
}

export async function resolveCommitment(
    date: string,
    status: 'done' | 'partial' | 'skipped',
    reflection?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('daily_commitments')
        .update({ status, reflection: reflection || null })
        .eq('user_id', user.id)
        .eq('date', date)

    if (error) throw error
    revalidatePath('/')
    revalidatePath('/ritual')
    return { status }
}

export async function getCommitmentStats() {
    const history = await getCommitmentHistory(30)
    const resolved = history.filter((c: any) => c.status !== 'pending')
    const done = history.filter((c: any) => c.status === 'done').length
    const partial = history.filter((c: any) => c.status === 'partial').length

    // Racha: días consecutivos hacia atrás con compromiso cumplido (done o partial)
    const today = await getAppToday()
    const byDate = new Map(history.map((c: any) => [c.date, c]))
    let streak = 0
    for (let i = 0; i < 60; i++) {
        const d = addDaysToDateStr(today, -i)
        const c: any = byDate.get(d)
        if (c && (c.status === 'done' || c.status === 'partial')) streak++
        else if (i > 0) break
    }

    return {
        total: history.length,
        done,
        partial,
        skipped: history.filter((c: any) => c.status === 'skipped').length,
        successRate: resolved.length ? Math.round(((done + partial * 0.5) / resolved.length) * 100) : 0,
        streak
    }
}

export interface CommitmentSuggestion {
    date: string
    action: string
    scheduled_time: string | null
    location: string | null
    two_minute_version: string | null
    identity_why: string | null
    obstacle: string | null
    if_then_plan: string | null
    reasoning: string
}

/**
 * El coach propone el compromiso de mañana leyendo todo el Segundo Cerebro:
 * qué viene fallando, qué tareas hay abiertas, qué entrenamiento toca.
 *
 * Devuelve ActionResult en vez de tirar el error: en producción Next.js
 * enmascara cualquier excepción de una server action y el usuario solo ve
 * "An error occurred in the Server Components render".
 */
export async function suggestTomorrowCommitment(
    targetDate?: string
): Promise<ActionResult<CommitmentSuggestion>> {
    return runAction('suggestTomorrowCommitment', () => buildCommitmentSuggestion(targetDate))
}

async function buildCommitmentSuggestion(targetDate?: string): Promise<CommitmentSuggestion> {
    const date = targetDate || addDaysToDateStr(await getAppToday(), 1)
    const snapshot = await buildBrainSnapshot()

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Sos el coach del usuario. Proponé el compromiso para el día ${date}: UNA sola acción, la que más mueva la aguja.

Reglas duras:
- UNA sola acción. Nada de listas.
- Tiene que poder hacerse en 45 minutos o menos.
- Si un hábito viene fallando hace días, proponé la MITAD de lo que venía intentando, no lo mismo.
- La versión de 2 minutos tiene que ser imposible de fallar incluso en el peor día (ej: "ponerme las zapatillas y salir a la vereda").
- El plan si-entonces tiene que atacar el obstáculo más probable según sus datos reales.
- El "por qué de identidad" se escribe en primera persona y empieza con "Soy alguien que…".
- Todo en español rioplatense con voseo.

Respondé SOLO con este JSON:
{
  "action": "acción concreta y específica",
  "scheduled_time": "HH:MM",
  "location": "dónde exactamente",
  "two_minute_version": "la versión mínima",
  "identity_why": "Soy alguien que...",
  "obstacle": "lo más probable que salga mal",
  "if_then_plan": "Si ..., entonces ...",
  "reasoning": "una frase explicando por qué elegiste esto mirando sus datos"
}`.trim()

    const text = await generateText(prompt, { temperature: 0.7, maxOutputTokens: 1600, json: true })
    const parsed = parseJSON<any>(text)

    if (!parsed.action) throw new Error('La IA no devolvió ninguna acción. Probá de nuevo.')

    return {
        date,
        action: parsed.action,
        scheduled_time: parsed.scheduled_time || null,
        location: parsed.location || null,
        two_minute_version: parsed.two_minute_version || null,
        identity_why: parsed.identity_why || null,
        obstacle: parsed.obstacle || null,
        if_then_plan: parsed.if_then_plan || null,
        reasoning: parsed.reasoning || ''
    }
}
