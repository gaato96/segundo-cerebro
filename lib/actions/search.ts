'use server'

import { createClient } from '@/lib/supabase/server'
import { generateText, parseJSON } from '@/lib/ai'
import { runAction, type ActionResult } from '@/lib/actionResult'

/**
 * Búsqueda global. Alimenta el command palette (Ctrl+K).
 *
 * No hay índice de texto completo: son ILIKE sobre las columnas que importan.
 * Con el volumen de datos de un usuario único es instantáneo y no agrega infra.
 */

export interface SearchResult {
    id: string
    type: 'task' | 'note' | 'recipe' | 'objective' | 'event' | 'wishlist' | 'media' | 'journal' | 'knowledge' | 'idea'
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
    journal: 'Journal',
    knowledge: 'Nota',
    idea: 'Idea'
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

    const [tasks, notes, recipes, objectives, events, wishlist, media, journal, knowledge, ideas] = await Promise.all([
        supabase.from('tasks').select('id, title, status, due_date').eq('user_id', uid).ilike('title', pattern).limit(6),
        supabase.from('mental_notes').select('id, content, is_processed').eq('user_id', uid).ilike('content', pattern).limit(5),
        supabase.from('recipes').select('id, name, description').eq('user_id', uid).ilike('name', pattern).limit(5),
        supabase.from('objectives').select('id, title, timeframe').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('events').select('id, title, event_date').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('wishlist').select('id, name, price').eq('user_id', uid).ilike('name', pattern).limit(4),
        supabase.from('media_backlog').select('id, title, type, status').eq('user_id', uid).ilike('title', pattern).limit(4),
        supabase.from('journal_entries').select('id, date, content').eq('user_id', uid).ilike('content', pattern).limit(4),
        // Sin la migración 028 la tabla notes no existe: devuelve error y se ignora.
        supabase.from('notes').select('id, title, updated_at').eq('user_id', uid).or(`title.ilike.${pattern},content.ilike.${pattern}`).limit(6),
        supabase.from('idea_bank').select('id, title, status').eq('user_id', uid).ilike('title', pattern).limit(4)
    ])

    const results: SearchResult[] = []

    for (const k of knowledge.data || []) {
        results.push({ id: k.id, type: 'knowledge', title: k.title, subtitle: 'Nota', url: `/notas?id=${k.id}` })
    }
    for (const i of ideas.data || []) {
        results.push({ id: i.id, type: 'idea', title: i.title, subtitle: i.status || 'Idea', url: '/ideas' })
    }

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

// ============================================================
// PREGUNTARLE AL CEREBRO
//
// "¿Qué decidí sobre Vivomenú?" → busca en notas, journal, ideas, tareas,
// capturas y objetivos, y la IA responde SOLO con lo que encontró, citando
// de dónde lo sacó. Si no hay nada, lo dice.
// ============================================================

const STOP = new Set(('que qué como cómo cuando cuándo donde dónde para por con sin sobre una uno unos unas los las del de la el en y o a mi mis me tengo tenia tenía hice dije decidi decidí fue era hay esta está este esto eso ese esa ' +
    'cual cuál cuales quien quién algo todo toda todos alguna algun algún hacer hago voy vamos tenemos').split(' '))

export interface BrainAnswer {
    answer: string
    sources: SearchResult[]
}

export async function askBrain(question: string): Promise<ActionResult<BrainAnswer>> {
    return runAction('askBrain', async () => {
        const q = question.trim()
        if (q.length < 4) throw new Error('Escribí una pregunta un poco más larga.')

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No hay sesión iniciada.')
        const uid = user.id

        const words = Array.from(new Set(
            q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !STOP.has(w))
        )).slice(0, 6)
        if (!words.length) throw new Error('No encontré palabras clave en la pregunta.')

        const ors = (cols: string[]) => words.flatMap(w => cols.map(c => `${c}.ilike.%${w.replace(/[%_,()]/g, '')}%`)).join(',')

        const [notes, journal, ideas, tasks, captures, objectives] = await Promise.all([
            supabase.from('notes').select('id, title, content, updated_at').eq('user_id', uid).or(ors(['title', 'content'])).limit(8),
            supabase.from('journal_entries').select('id, date, content').eq('user_id', uid).or(ors(['content'])).order('date', { ascending: false }).limit(6),
            supabase.from('idea_bank').select('id, title, content').eq('user_id', uid).or(ors(['title', 'content'])).limit(5),
            supabase.from('tasks').select('id, title, description, status, due_date').eq('user_id', uid).or(ors(['title', 'description'])).limit(8),
            supabase.from('mental_notes').select('id, content, created_at').eq('user_id', uid).or(ors(['content'])).order('created_at', { ascending: false }).limit(6),
            supabase.from('objectives').select('id, title, description, progress_pct, status').eq('user_id', uid).or(ors(['title', 'description'])).limit(4)
        ])

        const sources: SearchResult[] = []
        const docs: string[] = []
        const add = (r: SearchResult, body: string) => {
            sources.push(r)
            docs.push(`[${sources.length}] (${TYPE_LABEL[r.type]}${r.subtitle ? ` · ${r.subtitle}` : ''}) ${r.title}\n${body.replace(/\s+/g, ' ').slice(0, 700)}`)
        }

        for (const n of notes.data || []) add({ id: n.id, type: 'knowledge', title: n.title, subtitle: String(n.updated_at).slice(0, 10), url: `/notas?id=${n.id}` }, n.content || '')
        for (const j of journal.data || []) add({ id: j.id, type: 'journal', title: `Journal ${j.date}`, subtitle: j.date, url: '/journal' }, j.content || '')
        for (const i of ideas.data || []) add({ id: i.id, type: 'idea', title: i.title, url: '/ideas' }, i.content || '')
        for (const t of tasks.data || []) add({ id: t.id, type: 'task', title: t.title, subtitle: t.status === 'Done' ? 'hecha' : 'pendiente', url: '/tasks' }, t.description || '')
        for (const c of captures.data || []) add({ id: c.id, type: 'note', title: String(c.content).slice(0, 80), subtitle: String(c.created_at).slice(0, 10), url: '/inbox' }, c.content || '')
        for (const o of objectives.data || []) add({ id: o.id, type: 'objective', title: o.title, subtitle: `${o.progress_pct || 0}%`, url: '/okrs' }, o.description || '')

        if (!sources.length) {
            return { answer: 'No encontré nada guardado sobre eso en tus notas, journal, ideas, tareas ni capturas.', sources: [] }
        }

        const prompt = `Pregunta del usuario: "${q}"

Esto es lo que tiene guardado en su Segundo Cerebro (numerado):
${docs.join('\n\n')}

Respondé la pregunta usando SOLO esta información. Reglas:
- Si la respuesta está, decila directo en 1 a 4 frases y citá los números entre corchetes, ej: "Decidiste arrancar por GALU [2]".
- Si no está, decí que no lo encontrás y qué es lo más parecido que hay.
- No inventes nada que no esté arriba. Español rioplatense, voseo.

Respondé SOLO con JSON: { "answer": "...", "used": [1, 2] }`

        const text = await generateText(prompt, { temperature: 0.2, maxOutputTokens: 700, json: true })
        const parsed = parseJSON<{ answer?: string; used?: number[] }>(text)
        const used = (parsed.used || []).map(n => sources[n - 1]).filter(Boolean)

        return {
            answer: parsed.answer || 'No pude armar una respuesta.',
            sources: used.length ? used : sources.slice(0, 4)
        }
    })
}
