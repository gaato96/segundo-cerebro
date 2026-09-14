'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { getLocalDateStr, addDaysToDateStr, formatLocalDate } from '@/lib/utils'
import { runAction, type ActionResult } from '@/lib/actionResult'

/**
 * Procesar el inbox con IA.
 *
 * El vaciado mental es cero fricción para escribir y mucha para procesar:
 * cada captura hay que clasificarla a mano. Esto propone el destino de cada una
 * y vos confirmás. La IA nunca escribe sola en tus tablas.
 */

export type NoteDestination = 'task' | 'event' | 'journal' | 'wishlist' | 'note' | 'discard'

export interface NoteSuggestion {
    note_id: string
    destination: NoteDestination
    title: string
    description?: string
    /** task */
    priority?: 1 | 2 | 3
    category?: 'Work' | 'Personal'
    energy_level?: string
    due_date?: string | null
    /** event */
    event_date?: string | null
    start_time?: string | null
    /** wishlist */
    price?: number | null
    reason: string
}

const DESTINATIONS_DOC = `
- "task": hay una acción concreta que alguien tiene que hacer.
- "event": hay una fecha y hora específicas (reunión, turno, cumpleaños).
- "journal": es una reflexión, un estado de ánimo o algo que pasó. No hay acción.
- "wishlist": es algo que quiere comprar.
- "note": información de referencia que conviene guardar pero no es ninguna de las anteriores.
- "discard": es ruido, quedó viejo o ya no aplica.
`

/**
 * Propone destino para hasta 20 capturas en una sola llamada.
 *
 * Devuelve ActionResult: si tira el error, en producción Next.js lo enmascara
 * y el usuario no se entera de qué falló.
 */
export async function suggestInboxActions(noteIds?: string[]): Promise<ActionResult<NoteSuggestion[]>> {
    return runAction('suggestInboxActions', () => buildInboxSuggestions(noteIds))
}

async function buildInboxSuggestions(noteIds?: string[]): Promise<NoteSuggestion[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    let query = supabase
        .from('mental_notes')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .eq('is_processed', false)
        .order('created_at', { ascending: false })
        .limit(20)

    if (noteIds?.length) query = query.in('id', noteIds)

    const { data: notes, error } = await query
    if (error) throw error
    if (!notes?.length) return []

    const today = getLocalDateStr()

    const list = notes
        .map((n, i) => `[${i}] (capturada el ${String(n.created_at).slice(0, 10)}) ${n.content.replace(/\s+/g, ' ').slice(0, 400)}`)
        .join('\n')

    const prompt = `
Hoy es ${formatLocalDate(new Date())} (${today}).

Estas son capturas rápidas del vaciado mental de un usuario en Tucumán, Argentina. Clasificá cada una según a dónde debería ir:
${DESTINATIONS_DOC}

Capturas:
${list}

Reglas:
- El "title" tiene que ser accionable y corto (máximo 80 caracteres). Si es tarea, que empiece con un verbo en infinitivo.
- Si la captura menciona un plazo relativo ("el viernes", "la semana que viene"), convertilo a fecha real YYYY-MM-DD desde hoy.
- Si no hay fecha clara, dejá las fechas en null. No inventes.
- priority: 1 alta, 2 media, 3 baja. Solo para tareas.
- category: "Work" si es del trabajo o de clientes, "Personal" si no.
- "reason" es una sola frase corta explicando por qué elegiste ese destino.
- Español rioplatense.

Respondé SOLO con este JSON:
{ "items": [ { "index": 0, "destination": "task", "title": "...", "description": "...", "priority": 2, "category": "Personal", "due_date": null, "event_date": null, "start_time": null, "price": null, "reason": "..." } ] }`.trim()

    const text = await generateText(prompt, { temperature: 0.3, maxOutputTokens: 2500, json: true })
    const parsed = parseJSON<{ items?: any[] }>(text)

    return (parsed.items || [])
        .filter(item => typeof item.index === 'number' && notes[item.index])
        .map(item => ({
            note_id: notes[item.index].id,
            destination: (item.destination || 'note') as NoteDestination,
            title: (item.title || notes[item.index].content).slice(0, 120),
            description: item.description || notes[item.index].content,
            priority: [1, 2, 3].includes(item.priority) ? item.priority : 2,
            category: item.category === 'Work' ? 'Work' : 'Personal',
            energy_level: item.energy_level || 'Deep Work',
            due_date: item.due_date || null,
            event_date: item.event_date || null,
            start_time: item.start_time || null,
            price: typeof item.price === 'number' ? item.price : null,
            reason: item.reason || ''
        }))
}

/** Ejecuta una sugerencia ya confirmada por el usuario. */
export async function applyInboxSuggestion(suggestion: NoteSuggestion) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: note } = await supabase
        .from('mental_notes')
        .select('*')
        .eq('id', suggestion.note_id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!note) throw new Error('La captura ya no existe')

    switch (suggestion.destination) {
        case 'task': {
            const { error } = await supabase.from('tasks').insert({
                user_id: user.id,
                title: suggestion.title.slice(0, 200),
                description: suggestion.description || note.content,
                priority: suggestion.priority || 2,
                category: suggestion.category || 'Personal',
                energy_level: suggestion.energy_level || 'Deep Work',
                status: 'Todo',
                due_date: suggestion.due_date || null
            })
            if (error) throw error
            break
        }

        case 'event': {
            const { error } = await supabase.from('events').insert({
                user_id: user.id,
                title: suggestion.title.slice(0, 200),
                description: suggestion.description || note.content,
                event_date: suggestion.event_date || addDaysToDateStr(getLocalDateStr(), 1),
                start_time: suggestion.start_time || null,
                event_type: 'event',
                is_all_day: !suggestion.start_time
            })
            if (error) throw error
            break
        }

        case 'journal': {
            const date = getLocalDateStr()
            const { data: existing } = await supabase
                .from('journal_entries')
                .select('id, content')
                .eq('user_id', user.id)
                .eq('date', date)
                .maybeSingle()

            if (existing) {
                await supabase
                    .from('journal_entries')
                    .update({ content: `${existing.content || ''}\n\n${note.content}`.trim() })
                    .eq('id', existing.id)
            } else {
                await supabase.from('journal_entries').insert({
                    user_id: user.id,
                    date,
                    content: note.content
                })
            }
            break
        }

        case 'wishlist': {
            const { error } = await supabase.from('wishlist').insert({
                user_id: user.id,
                name: suggestion.title.slice(0, 200),
                price: suggestion.price,
                notes: note.content,
                desire_level: 3,
                purchased: false
            })
            if (error) throw error
            break
        }

        case 'note':
        case 'discard':
        default:
            // No se crea nada: solo se saca del inbox.
            break
    }

    const { error: markError } = await supabase
        .from('mental_notes')
        .update({
            is_processed: true,
            processed_as: suggestion.destination,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', suggestion.note_id)
        .eq('user_id', user.id)

    if (markError) throw markError

    revalidatePath('/inbox')
    revalidatePath('/tasks')
    revalidatePath('/calendar')
    revalidatePath('/')
    return { ok: true, destination: suggestion.destination }
}

/** Aplica varias sugerencias de una, en orden. Devuelve cuántas salieron bien. */
export async function applyInboxSuggestions(suggestions: NoteSuggestion[]) {
    let applied = 0
    const failures: string[] = []

    for (const s of suggestions) {
        try {
            await applyInboxSuggestion(s)
            applied++
        } catch (e: any) {
            failures.push(`${s.title}: ${e?.message || 'error'}`)
        }
    }

    return { applied, failures }
}
