'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getJournalEntry(date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

    if (error && error.code !== 'PGRST116') throw error // Ignore "not found"
    return data
}

export async function saveJournalEntry(date: string, content: string, mood?: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Check if exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

    if (existing) {
        // Update
        const { error } = await supabase
            .from('journal_entries')
            .update({
                content,
                ...(mood && { mood }),
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

        if (error) throw error
    } else {
        // Insert
        const { error } = await supabase
            .from('journal_entries')
            .insert({
                user_id: user.id,
                date,
                content,
                mood,
            })

        if (error) throw error
    }

    revalidatePath('/journal')
}

export async function appendToJournal(date: string, newContent: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id, content')
        .eq('user_id', user.id)
        .eq('date', date)
        .single()

    const fullContent = existing && existing.content ? existing.content + '\n\n' + newContent : newContent

    if (existing) {
        const { error } = await supabase
            .from('journal_entries')
            .update({ content: fullContent, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('journal_entries')
            .insert({ user_id: user.id, date, content: fullContent })
        if (error) throw error
    }
    revalidatePath('/journal')
}

/** El mes para la tira de ánimo, la racha de escritura y qué escribiste este mismo día otros años. */
export async function getJournalMonth(month: string, day: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { entries: [], dates: [], memories: [] }
    const [y, m] = month.split('-').map(Number)
    const last = String(new Date(y, m, 0).getDate()).padStart(2, '0')
    const years = [1, 2, 3].map(n => `${Number(day.slice(0, 4)) - n}${day.slice(4)}`).filter(d => !d.endsWith('-02-29'))
    const [entries, dates, memories] = await Promise.all([
        supabase.from('journal_entries').select('date, mood, content').eq('user_id', user.id).gte('date', `${month}-01`).lte('date', `${month}-${last}`).order('date'),
        supabase.from('journal_entries').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(120),
        supabase.from('journal_entries').select('date, content').eq('user_id', user.id).in('date', years)
    ])
    return {
        entries: (entries.data || []).map(e => ({ date: String(e.date), mood: e.mood as number | null, words: String(e.content || '').split(/\s+/).filter(Boolean).length })),
        dates: (dates.data || []).map(d => String(d.date)),
        memories: (memories.data || []).map(x => ({ date: String(x.date), content: String(x.content || '').slice(0, 220) }))
    }
}
