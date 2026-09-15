'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateText, parseJSON } from '@/lib/ai'
import { buildBrainSnapshot } from '@/lib/actions/assistant'
import { runAction, type ActionResult } from '@/lib/actionResult'

/**
 * Banco de ideas.
 *
 * Procesar una captura como "archivar" la sacaba del inbox y no la mostraba en
 * ningún lado: la idea no se borraba, pero era como si sí. Acá viven, se pueden
 * puntuar por impacto/esfuerzo y ascender a tarea o a objetivo.
 */

export type IdeaStatus = 'raw' | 'exploring' | 'promoted' | 'archived'

export interface IdeaItem {
    id: string
    user_id: string
    title: string
    content: string | null
    category: string | null
    tags: string[]
    status: IdeaStatus
    impact: number | null
    effort: number | null
    source: string | null
    source_note_id: string | null
    promoted_to: string | null
    created_at: string
    updated_at: string
}

export async function getIdeas(status?: IdeaStatus): Promise<IdeaItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
        .from('idea_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
        console.error('Error fetching ideas:', error)
        return []
    }
    return (data || []) as IdeaItem[]
}

/**
 * Capturas ya procesadas que no generaron nada en ningún módulo.
 * Es el "¿dónde quedó lo que archivé?" — nada se borró nunca.
 */
export async function getArchivedNotes(limit = 100) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('mental_notes')
        .select('id, content, created_at, processed_as, processed_at')
        .eq('user_id', user.id)
        .eq('is_processed', true)
        .order('processed_at', { ascending: false, nullsFirst: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching archived notes:', error)
        return []
    }
    return data || []
}

export async function createIdea(input: {
    title: string
    content?: string | null
    category?: string | null
    tags?: string[]
    impact?: number | null
    effort?: number | null
    source?: string
    source_note_id?: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = input.title?.trim()
    if (!title) return { error: 'La idea necesita un título.' }

    const { data, error } = await supabase
        .from('idea_bank')
        .insert({
            user_id: user.id,
            title: title.slice(0, 200),
            content: input.content || null,
            category: input.category || 'General',
            tags: input.tags || [],
            impact: input.impact ?? null,
            effort: input.effort ?? null,
            source: input.source || 'manual',
            source_note_id: input.source_note_id || null
        })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath('/ideas')
    return { success: true, idea: data }
}

export async function updateIdea(id: string, updates: Partial<Pick<IdeaItem, 'title' | 'content' | 'category' | 'status' | 'impact' | 'effort'>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('idea_bank')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/ideas')
    return { success: true }
}

export async function deleteIdea(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('idea_bank')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/ideas')
    return { success: true }
}

/** Rescata una captura vieja del archivo y la trae al banco de ideas. */
export async function saveNoteAsIdea(noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: note } = await supabase
        .from('mental_notes')
        .select('id, content')
        .eq('id', noteId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!note) return { error: 'Esa captura ya no existe.' }

    const { data: existing } = await supabase
        .from('idea_bank')
        .select('id')
        .eq('source_note_id', noteId)
        .maybeSingle()

    if (existing) return { success: true, alreadyThere: true }

    const clean = String(note.content).replace(/\s+/g, ' ').trim()

    const { error } = await supabase
        .from('idea_bank')
        .insert({
            user_id: user.id,
            title: clean.slice(0, 80),
            content: note.content,
            source: 'inbox',
            source_note_id: noteId
        })

    if (error) return { error: error.message }

    revalidatePath('/ideas')
    return { success: true }
}

/** Convierte una idea en tarea concreta. La idea queda marcada como ascendida. */
export async function promoteIdeaToTask(id: string, plannedDate?: string | null) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: idea } = await supabase
        .from('idea_bank')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!idea) return { error: 'Esa idea ya no existe.' }

    const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: String(idea.title).slice(0, 200),
        description: idea.content || null,
        status: 'Todo',
        priority: 2,
        category: 'Personal',
        planned_date: plannedDate || null
    })

    if (error) return { error: error.message }

    await supabase
        .from('idea_bank')
        .update({ status: 'promoted', promoted_to: 'task' })
        .eq('id', id)
        .eq('user_id', user.id)

    revalidatePath('/ideas')
    revalidatePath('/tasks')
    return { success: true }
}

/** Convierte una idea en objetivo del módulo OKRs. */
export async function promoteIdeaToObjective(id: string, timeframe: 'Year' | 'Q1' | 'Q2' | 'Q3' | 'Q4' = 'Q1') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { data: idea } = await supabase
        .from('idea_bank')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!idea) return { error: 'Esa idea ya no existe.' }

    const { error } = await supabase.from('objectives').insert({
        user_id: user.id,
        title: String(idea.title).slice(0, 200),
        description: idea.content || null,
        timeframe,
        type: 'Personal',
        status: 'Active',
        progress_pct: 0
    })

    if (error) return { error: error.message }

    await supabase
        .from('idea_bank')
        .update({ status: 'promoted', promoted_to: 'objective' })
        .eq('id', id)
        .eq('user_id', user.id)

    revalidatePath('/ideas')
    revalidatePath('/okrs')
    return { success: true }
}

// ============================================================
// LA IA ORDENA EL BANCO
// ============================================================

export interface IdeaReview {
    scored: { id: string; title: string; impact: number; effort: number; category: string; verdict: string }[]
    top_pick: { id: string; title: string; why: string; first_step: string } | null
    prune: { id: string; title: string; why: string }[]
    summary: string
}

/**
 * Le pide a la IA que puntúe y ordene el banco: un banco de ideas sin curar es
 * otro lugar donde se acumula ruido.
 */
export async function reviewIdeaBank(): Promise<ActionResult<IdeaReview>> {
    return runAction('reviewIdeaBank', buildIdeaReview)
}

async function buildIdeaReview(): Promise<IdeaReview> {
    const ideas = (await getIdeas()).filter(i => i.status !== 'archived' && i.status !== 'promoted')
    if (!ideas.length) throw new Error('No hay ideas activas para revisar.')

    const snapshot = await buildBrainSnapshot()
    const list = ideas
        .slice(0, 40)
        .map((i, idx) => `[${idx}] ${i.title}${i.content && i.content !== i.title ? ` — ${String(i.content).replace(/\s+/g, ' ').slice(0, 220)}` : ''}`)
        .join('\n')

    const prompt = `
<segundo_cerebro>
${snapshot}
</segundo_cerebro>

Banco de ideas del usuario, numerado:
${list}

Sos su socio estratégico. Puntuá cada idea mirando su situación REAL (su plata, su tiempo, sus objetivos, lo que ya tiene abierto).

Reglas:
- "impact" y "effort" van de 1 a 5. Sé honesto: casi nada es impacto 5.
- Elegí UNA sola idea como "top_pick": la que más le conviene empezar ahora dado su contexto, y dale un primer paso de menos de 30 minutos.
- En "prune" poné las que conviene soltar (como mucho 3) y por qué. Si no hay ninguna, dejá la lista vacía.
- "verdict" es una frase corta por idea.
- Español rioplatense con voseo, directo.

Respondé SOLO con este JSON:
{
  "scored": [ { "index": 0, "impact": 3, "effort": 2, "category": "Negocio", "verdict": "..." } ],
  "top_pick": { "index": 0, "why": "...", "first_step": "..." },
  "prune": [ { "index": 5, "why": "..." } ],
  "summary": "una frase sobre el estado general del banco"
}`.trim()

    const text = await generateText(prompt, { temperature: 0.4, maxOutputTokens: 2500, json: true })
    const parsed = parseJSON<any>(text)

    const clamp = (n: any) => {
        const v = Number(n)
        return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 1), 5) : 3
    }

    const scored = (Array.isArray(parsed.scored) ? parsed.scored : [])
        .filter((s: any) => typeof s?.index === 'number' && ideas[s.index])
        .map((s: any) => ({
            id: ideas[s.index].id,
            title: ideas[s.index].title,
            impact: clamp(s.impact),
            effort: clamp(s.effort),
            category: s.category || 'General',
            verdict: s.verdict || ''
        }))

    const topIdx = parsed.top_pick?.index
    const top_pick = typeof topIdx === 'number' && ideas[topIdx]
        ? {
            id: ideas[topIdx].id,
            title: ideas[topIdx].title,
            why: parsed.top_pick.why || '',
            first_step: parsed.top_pick.first_step || ''
        }
        : null

    const prune = (Array.isArray(parsed.prune) ? parsed.prune : [])
        .filter((p: any) => typeof p?.index === 'number' && ideas[p.index])
        .map((p: any) => ({ id: ideas[p.index].id, title: ideas[p.index].title, why: p.why || '' }))

    return { scored, top_pick, prune, summary: parsed.summary || '' }
}

/** Guarda en la base las puntuaciones que propuso la IA. */
export async function applyIdeaScores(scores: { id: string; impact: number; effort: number; category: string }[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    for (const s of scores) {
        await supabase
            .from('idea_bank')
            .update({ impact: s.impact, effort: s.effort, category: s.category })
            .eq('id', s.id)
            .eq('user_id', user.id)
    }

    revalidatePath('/ideas')
    return { success: true, updated: scores.length }
}
