'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocalDateStr, addDaysToDateStr } from '@/lib/utils'

/**
 * Ritual nocturno: el cierre que le faltaba al día.
 *
 * El ritual matutino ya existía, pero el día nunca terminaba: el compromiso
 * quedaba sin resolver y el de mañana dependía de que te acordaras.
 * Estos 5 minutos cierran el loop.
 */

export interface EveningRitualInput {
    date?: string
    day_rating?: number | null
    win?: string | null
    gratitude?: string | null
    brain_dump?: string | null
    tomorrow_committed?: boolean
    inbox_cleared?: boolean
}

export async function getEveningRitual(date?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('evening_ritual_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date || getLocalDateStr())
        .maybeSingle()

    if (error) throw error
    return data
}

export async function saveEveningRitual(input: EveningRitualInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const date = input.date || getLocalDateStr()

    const { data, error } = await supabase
        .from('evening_ritual_logs')
        .upsert({
            user_id: user.id,
            date,
            day_rating: input.day_rating || null,
            win: input.win || null,
            gratitude: input.gratitude || null,
            brain_dump: input.brain_dump || null,
            tomorrow_committed: input.tomorrow_committed ?? false,
            inbox_cleared: input.inbox_cleared ?? false,
            completed_at: new Date().toISOString()
        }, { onConflict: 'user_id, date' })
        .select()
        .single()

    if (error) throw error

    // La victoria del día vive en su propia tabla: se espeja para no duplicar carga.
    if (input.win?.trim()) {
        await supabase
            .from('daily_wins')
            .upsert({ user_id: user.id, date, win: input.win.trim() }, { onConflict: 'user_id, date' })
    }

    // Lo que quedó dando vueltas entra al inbox como captura, no se pierde.
    if (input.brain_dump?.trim()) {
        await supabase
            .from('mental_notes')
            .insert({ user_id: user.id, content: input.brain_dump.trim(), is_processed: false })
    }

    // El ánimo del día alimenta el journal, que es de donde salen las correlaciones.
    if (input.day_rating) {
        const { data: existing } = await supabase
            .from('journal_entries')
            .select('id, mood, content')
            .eq('user_id', user.id)
            .eq('date', date)
            .maybeSingle()

        if (existing) {
            if (!existing.mood) {
                await supabase.from('journal_entries').update({ mood: input.day_rating }).eq('id', existing.id)
            }
        } else {
            await supabase.from('journal_entries').insert({
                user_id: user.id,
                date,
                mood: input.day_rating,
                content: input.gratitude || ''
            })
        }
    }

    revalidatePath('/')
    revalidatePath('/cierre')
    revalidatePath('/journal')
    revalidatePath('/inbox')
    return data
}

export async function getEveningRitualStats(days = 30) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const today = getLocalDateStr()
    const from = addDaysToDateStr(today, -days)

    const { data, error } = await supabase
        .from('evening_ritual_logs')
        .select('date, day_rating')
        .eq('user_id', user.id)
        .gte('date', from)
        .order('date', { ascending: false })

    if (error) throw error

    const logs = data || []
    const dates = new Set(logs.map(l => l.date))

    // La racha se cuenta desde ayer: hoy todavía podés hacerlo.
    let streak = 0
    for (let i = 1; i <= days; i++) {
        if (dates.has(addDaysToDateStr(today, -i))) streak++
        else break
    }
    if (dates.has(today)) streak++

    const ratings = logs.filter(l => l.day_rating).map(l => l.day_rating as number)
    const avgRating = ratings.length
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
        : null

    return { total: logs.length, streak, avgRating, doneToday: dates.has(today) }
}
