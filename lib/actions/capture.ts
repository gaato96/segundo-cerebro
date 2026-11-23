'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { parseQuick } from '@/lib/nlParse'
import { getAppToday } from '@/lib/actions/day'

/**
 * Captura universal: un solo lugar para anotar cualquier cosa en 2 segundos.
 * Sin tipo va al Inbox (se clasifica después). Con tipo va directo a su lugar,
 * entendiendo fechas y horas en lenguaje natural.
 */

export type CaptureKind = 'inbox' | 'task' | 'event' | 'idea' | 'note'
export type CaptureSource = 'keyboard' | 'voice' | 'share'

export interface CaptureResult {
    kind: CaptureKind
    id: string
    label: string
    url: string
}

export async function captureItem(input: {
    text: string
    kind?: CaptureKind
    source?: CaptureSource
}): Promise<ActionResult<CaptureResult>> {
    return runAction('captureItem', async () => {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No hay sesión iniciada.')

        const text = input.text.trim()
        if (!text) throw new Error('No hay nada para guardar.')

        const kind = input.kind || 'inbox'
        const today = await getAppToday()
        const parsed = parseQuick(text, today)

        switch (kind) {
            case 'task': {
                const { data, error } = await supabase
                    .from('tasks')
                    .insert({
                        user_id: user.id,
                        title: parsed.title.slice(0, 200),
                        priority: parsed.priority || 2,
                        category: 'Personal',
                        energy_level: 'Deep Work',
                        status: 'Todo',
                        due_date: parsed.date,
                        planned_date: parsed.date === today ? today : null,
                        reminder_time: parsed.time ? `${parsed.time}:00` : null,
                        reminder_fired: false
                    })
                    .select('id')
                    .single()
                if (error) throw error
                revalidatePath('/tasks')
                revalidatePath('/')
                return {
                    kind, id: data.id, url: '/tasks',
                    label: ['Tarea', ...parsed.summary].join(' · ')
                }
            }

            case 'event': {
                const { data, error } = await supabase
                    .from('events')
                    .insert({
                        user_id: user.id,
                        title: parsed.title.slice(0, 200),
                        event_date: parsed.date || today,
                        start_time: parsed.time,
                        event_type: 'event',
                        color_hex: '#7C9CBF',
                        is_all_day: !parsed.time
                    })
                    .select('id')
                    .single()
                if (error) throw error
                revalidatePath('/calendar')
                revalidatePath('/planner')
                revalidatePath('/')
                return {
                    kind, id: data.id, url: '/calendar',
                    label: ['Evento', ...(parsed.summary.length ? parsed.summary : ['hoy'])].join(' · ')
                }
            }

            case 'idea': {
                const { data, error } = await supabase
                    .from('idea_bank')
                    .insert({
                        user_id: user.id,
                        title: text.slice(0, 200),
                        category: 'General',
                        tags: [],
                        source: 'capture'
                    })
                    .select('id')
                    .single()
                if (error) throw error
                revalidatePath('/ideas')
                return { kind, id: data.id, url: '/ideas', label: 'Idea guardada en el banco' }
            }

            case 'note': {
                const [first, ...rest] = text.split('\n')
                const { data, error } = await supabase
                    .from('notes')
                    .insert({
                        user_id: user.id,
                        title: first.slice(0, 160),
                        content: rest.join('\n').trim(),
                        source: 'manual'
                    })
                    .select('id')
                    .single()
                if (error) {
                    if (String(error.message).includes('notes')) {
                        throw new Error('Falta correr la migración 028 en Supabase para usar Notas.')
                    }
                    throw error
                }
                revalidatePath('/notas')
                return { kind, id: data.id, url: `/notas?id=${data.id}`, label: 'Nota creada' }
            }

            case 'inbox':
            default: {
                const row: Record<string, unknown> = { user_id: user.id, content: text, is_processed: false }
                if (input.source) row.source = input.source
                let { data, error } = await supabase.from('mental_notes').insert(row).select('id').single()
                // Sin la migración 028 la columna source no existe: se guarda igual sin ella.
                if (error && input.source) {
                    delete row.source
                    ;({ data, error } = await supabase.from('mental_notes').insert(row).select('id').single())
                }
                if (error || !data) throw error || new Error('No se pudo guardar.')
                revalidatePath('/inbox')
                revalidatePath('/')
                return { kind: 'inbox', id: data.id, url: '/inbox', label: 'Al Inbox' }
            }
        }
    })
}

/** Cuántas capturas esperan en el Inbox (badge del menú). */
export async function getInboxCount(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { count } = await supabase
        .from('mental_notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_processed', false)
    return count ?? 0
}
