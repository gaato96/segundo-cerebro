'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocalDateStr } from '@/lib/utils'

/** Postgres "relation does not exist": la migración 023 todavía no corrió. */
function isMissingTable(error: any): boolean {
    return error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '')
}

const MIGRATION_MSG = 'Falta correr la migración 023 (supabase/migrations/023_park_plan_football_matches.sql) en Supabase.'

async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    return { supabase, user }
}

function revalidate() {
    revalidatePath('/entrenamiento')
}

// ============================================================
// PLAN DE PARQUE
// ============================================================

/** Devuelve null si la tabla todavía no existe, así la página puede avisarlo. */
export async function getParkLogs() {
    const { supabase, user } = await getUser()
    const { data, error } = await supabase
        .from('park_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('week_number', { ascending: true })

    if (error) {
        if (isMissingTable(error)) return null
        throw error
    }
    return data || []
}

export async function logParkSession(input: {
    weekNumber: number
    sessionIndex: number
    minimum?: boolean
    withJulian?: boolean
    notes?: string
}) {
    const { supabase, user } = await getUser()
    const { error } = await supabase
        .from('park_logs')
        .upsert({
            user_id: user.id,
            week_number: input.weekNumber,
            session_index: input.sessionIndex,
            date: getLocalDateStr(),
            completed: true,
            skipped: false,
            minimum: !!input.minimum,
            with_julian: !!input.withJulian,
            notes: input.notes || null
        }, { onConflict: 'user_id,week_number,session_index' })

    if (error) throw new Error(isMissingTable(error) ? MIGRATION_MSG : error.message)
    revalidate()
}

export async function skipParkSession(weekNumber: number, sessionIndex: number) {
    const { supabase, user } = await getUser()
    const { error } = await supabase
        .from('park_logs')
        .upsert({
            user_id: user.id,
            week_number: weekNumber,
            session_index: sessionIndex,
            date: getLocalDateStr(),
            completed: false,
            skipped: true
        }, { onConflict: 'user_id,week_number,session_index' })

    if (error) throw new Error(isMissingTable(error) ? MIGRATION_MSG : error.message)
    revalidate()
}

export async function undoParkSession(weekNumber: number, sessionIndex: number) {
    const { supabase, user } = await getUser()
    const { error } = await supabase
        .from('park_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('week_number', weekNumber)
        .eq('session_index', sessionIndex)

    if (error) throw new Error(error.message)
    revalidate()
}

export async function restartParkPlan() {
    const { supabase, user } = await getUser()
    const { error } = await supabase.from('park_logs').delete().eq('user_id', user.id)
    if (error) throw new Error(error.message)
    revalidate()
}

// ============================================================
// PARTIDOS
// ============================================================

export interface MatchInput {
    date: string
    format: 'f5' | 'f7' | 'f8' | 'f11' | 'otro'
    minutes?: number | null
    overall: number
    stamina: number
    speed?: number | null
    touch?: number | null
    gassed_at_min?: number | null
    goals?: number
    assists?: number
    result?: 'ganado' | 'empatado' | 'perdido' | null
    notes?: string
}

export async function getFootballMatches() {
    const { supabase, user } = await getUser()
    const { data, error } = await supabase
        .from('football_matches')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) {
        if (isMissingTable(error)) return null
        throw error
    }
    return data || []
}

function clean(input: MatchInput) {
    const score = (n: number | null | undefined) =>
        n === null || n === undefined || Number.isNaN(n) ? null : Math.min(10, Math.max(1, Math.round(n)))
    return {
        date: input.date || getLocalDateStr(),
        format: input.format || 'f5',
        minutes: input.minutes || null,
        overall: score(input.overall) ?? 5,
        stamina: score(input.stamina) ?? 5,
        speed: score(input.speed),
        touch: score(input.touch),
        gassed_at_min: input.gassed_at_min ?? null,
        goals: Math.max(0, input.goals || 0),
        assists: Math.max(0, input.assists || 0),
        result: input.result || null,
        notes: input.notes?.trim() || null
    }
}

export async function saveFootballMatch(input: MatchInput, id?: string) {
    const { supabase, user } = await getUser()
    const row = clean(input)

    const { error } = id
        ? await supabase.from('football_matches').update(row).eq('id', id).eq('user_id', user.id)
        : await supabase.from('football_matches').insert({ ...row, user_id: user.id })

    if (error) throw new Error(isMissingTable(error) ? MIGRATION_MSG : error.message)
    revalidate()
}

export async function deleteFootballMatch(id: string) {
    const { supabase, user } = await getUser()
    const { error } = await supabase.from('football_matches').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw new Error(error.message)
    revalidate()
}
