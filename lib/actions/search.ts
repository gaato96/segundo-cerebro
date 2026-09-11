'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Búsqueda global. Alimenta el command palette (Ctrl+K).
 *
 * No hay índice de texto completo: son ILIKE sobre las columnas que importan.
 * Con el volumen de datos de un usuario único es instantáneo y no agrega infra.
 */

export interface SearchResult {
    id: string
    type: 'task' | 'note' | 'recipe' | 'objective' | 'event' | 'wishlist' | 'media' | 'journal'
    title: string
    subtitle?: string
    url: string
}

const TYPE_LABEL: Record<SearchResult['type'], string> = {
    task: 'Tarea',
    note: 'Captura',
    recipe: 'Receta',
    objective: 'Objetivo',
    event: 'Evento',
    wishlist: 'Deseo',
    media: 'Entretenimiento',
    journal: 'Journal'
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const term = query.trim()
    if (term.length < 2) return []

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Escapamos los comodines para que el usuario pueda buscar "%" o "_" literales.
    const pattern = `%${term.replace(/[%_]/g, m => `\\${m}`)}%`
    const uid = user.id

    const [tasks, notes, recipes, objectives, events, wishlist, media, journal] = await Promise.all([
        supabase.from('tasks').select('id, title, status, due_date').eq('user_id', uid).ilike('title', pattern).limit(6),
        supabase.from('mental_notes').select('id, content, is_processed').eq('user_id', uid).ilike('content', pattern).limit(5),
        supabase.from('recipes').select('id, name, description').eq('user_id', uid).ilike('name', pattern).limit(5),
        supabase.from('objectives').select('id, title, timeframe').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('events').select('id, title, event_date').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('wishlist').select('id, name, price').eq('user_id', uid).ilike('name', pattern).limit(4),
        supabase.from('media_backlog').select('id, title, type, status').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('journal_entries').select('id, date, content').eq('user_id', uid).ilike('content', pattern).limit(4)
    ])

    const results: SearchResult[] = []

    for (const t of tasks.data || []) {
        results.push({
            id: t.id,
            type: 'task',
            title: t.title,
            subtitle: t.status === 'Done' ? 'Completada' : t.due_date ? `Vence ${t.due_date}` : 'Pendiente',
            url: '/tasks'
        })
    }
    for (const n of notes.data || []) {
        results.push({
            id: n.id,
            type: 'note',
            title: String(n.content).replace(/\s+/g, ' ').slice(0, 90),
            subtitle: n.is_processed ? 'Procesada' : 'En el inbox',
            url: '/inbox'
        })
    }
    for (const r of recipes.data || []) {
        results.push({ id: r.id, type: 'recipe', title: r.name, subtitle: r.description?.slice(0, 60), url: '/meals' })
    }
    for (const o of objectives.data || []) {
        results.push({ id: o.id, type: 'objective', title: o.title, subtitle: o.timeframe, url: '/okrs' })
    }
    for (const e of events.data || []) {
        results.push({ id: e.id, type: 'event', title: e.title, subtitle: e.event_date, url: '/calendar' })
    }
    for (const w of wishlist.data || []) {
        results.push({
            id: w.id,
            type: 'wishlist',
            title: w.name,
            subtitle: w.price ? `$${Number(w.price).toLocaleString('es-AR')}` : undefined,
            url: '/wishlist'
        })
    }
    for (const m of media.data || []) {
        results.push({ id: m.id, type: 'media', title: m.title, subtitle: `${m.type} · ${m.status}`, url: '/media' })
    }
    for (const j of journal.data || []) {
        results.push({
            id: j.id,
            type: 'journal',
            title: String(j.content).replace(/\s+/g, ' ').slice(0, 90),
            subtitle: j.date,
            url: '/journal'
        })
    }

    return results
}

export async function searchTypeLabel(type: SearchResult['type']) {
    return TYPE_LABEL[type]
}
