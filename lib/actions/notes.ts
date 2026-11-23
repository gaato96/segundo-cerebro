'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { runAction, type ActionResult } from '@/lib/actionResult'
import { extractLinks } from '@/lib/wikilinks'

/**
 * Notas con enlaces [[ ]].
 *
 * Es la capa de conocimiento: lo que sabés, leíste o decidiste. Un enlace
 * [[Título]] apunta a otra nota, o si no existe, a un objetivo, tarea o libro
 * con ese título. Cada nota muestra quién la menciona (backlinks).
 */

export interface NoteItem {
    id: string
    title: string
    content: string
    tags: string[]
    source: string
    book_id: string | null
    pinned: boolean
    created_at: string
    updated_at: string
}

export interface LinkTarget {
    title: string
    type: 'note' | 'objective' | 'task' | 'book' | 'missing'
    url: string | null
    id: string | null
}

const MISSING_MSG = 'Falta correr la migración 028 en Supabase para usar Notas.'

function isMissingTable(error: any) {
    const m = String(error?.message || '')
    return error?.code === '42P01' || error?.code === 'PGRST205' || m.includes("'notes'") || m.includes('relation "notes"') || m.includes('notes')
}

async function requireUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión iniciada.')
    return { supabase, user }
}

export async function listNotes(): Promise<{ notes: NoteItem[]; missing: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { notes: [], missing: false }

    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(500)

    if (error) return { notes: [], missing: isMissingTable(error) }
    return { notes: (data || []) as NoteItem[], missing: false }
}

export async function createNote(input?: { title?: string; content?: string; tags?: string[] }): Promise<ActionResult<NoteItem>> {
    return runAction('createNote', async () => {
        const { supabase, user } = await requireUser()
        const { data, error } = await supabase
            .from('notes')
            .insert({
                user_id: user.id,
                title: (input?.title || 'Sin título').slice(0, 160),
                content: input?.content || '',
                tags: input?.tags || []
            })
            .select()
            .single()
        if (error) throw new Error(isMissingTable(error) ? MISSING_MSG : error.message)
        revalidatePath('/notas')
        return data as NoteItem
    })
}

export async function updateNote(id: string, patch: Partial<Pick<NoteItem, 'title' | 'content' | 'tags' | 'pinned'>>): Promise<ActionResult<{ updated_at: string }>> {
    return runAction('updateNote', async () => {
        const { supabase, user } = await requireUser()
        const updated_at = new Date().toISOString()
        const clean: Record<string, unknown> = { ...patch, updated_at }
        if (typeof patch.title === 'string') clean.title = patch.title.trim().slice(0, 160) || 'Sin título'
        if (patch.tags) clean.tags = patch.tags.map(t => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 12)
        const { error } = await supabase.from('notes').update(clean).eq('id', id).eq('user_id', user.id)
        if (error) throw error
        return { updated_at }
    })
}

export async function deleteNote(id: string): Promise<ActionResult<null>> {
    return runAction('deleteNote', async () => {
        const { supabase, user } = await requireUser()
        const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
        if (error) throw error
        revalidatePath('/notas')
        return null
    })
}

/**
 * Resuelve los [[enlaces]] de una nota y busca quién la menciona.
 * Orden de resolución: nota → objetivo → tarea → libro.
 */
export async function getNoteLinks(noteId: string, title: string, content: string): Promise<{ outgoing: LinkTarget[]; backlinks: { id: string; title: string; excerpt: string; type: 'note' | 'task' | 'objective'; url: string }[] }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { outgoing: [], backlinks: [] }
    const uid = user.id

    const titles = extractLinks(content)
    const lower = titles.map(t => t.toLowerCase())

    let outgoing: LinkTarget[] = []
    if (titles.length) {
        const [notes, objectives, tasks, books] = await Promise.all([
            supabase.from('notes').select('id, title').eq('user_id', uid).in('title', titles),
            supabase.from('objectives').select('id, title').eq('user_id', uid).in('title', titles),
            supabase.from('tasks').select('id, title').eq('user_id', uid).in('title', titles).limit(40),
            supabase.from('books').select('id, title').eq('user_id', uid).in('title', titles)
        ])
        // Coincidencia sin distinguir mayúsculas: se completa con una pasada en memoria.
        const pick = (rows: any[] | null, t: string) => (rows || []).find(r => String(r.title).toLowerCase() === t)
        outgoing = titles.map((t, i) => {
            const n = pick(notes.data, lower[i])
            if (n) return { title: t, type: 'note', id: n.id, url: `/notas?id=${n.id}` }
            const o = pick(objectives.data, lower[i])
            if (o) return { title: t, type: 'objective', id: o.id, url: '/okrs' }
            const k = pick(tasks.data, lower[i])
            if (k) return { title: t, type: 'task', id: k.id, url: `/foco?task=${k.id}` }
            const b = pick(books.data, lower[i])
            if (b) return { title: t, type: 'book', id: b.id, url: `/leer/${b.id}` }
            return { title: t, type: 'missing', id: null, url: null }
        })
    }

    const needle = `%[[${title.replace(/[%_]/g, m => `\\${m}`)}]]%`
    const [noteRefs, taskRefs, objRefs] = await Promise.all([
        supabase.from('notes').select('id, title, content').eq('user_id', uid).neq('id', noteId).ilike('content', needle).limit(20),
        supabase.from('tasks').select('id, title, description').eq('user_id', uid).ilike('description', needle).limit(10),
        supabase.from('objectives').select('id, title, description').eq('user_id', uid).ilike('description', needle).limit(10)
    ])

    const excerpt = (text: string) => {
        const i = text.toLowerCase().indexOf(`[[${title.toLowerCase()}]]`)
        if (i < 0) return text.slice(0, 140)
        return `${i > 60 ? '…' : ''}${text.slice(Math.max(0, i - 60), i + title.length + 80)}…`
    }

    const backlinks = [
        ...(noteRefs.data || []).map(n => ({ id: n.id, title: n.title, excerpt: excerpt(n.content || ''), type: 'note' as const, url: `/notas?id=${n.id}` })),
        ...(objRefs.data || []).map(o => ({ id: o.id, title: o.title, excerpt: excerpt(o.description || ''), type: 'objective' as const, url: '/okrs' })),
        ...(taskRefs.data || []).map(t => ({ id: t.id, title: t.title, excerpt: excerpt(t.description || ''), type: 'task' as const, url: `/foco?task=${t.id}` }))
    ]

    return { outgoing, backlinks }
}

/** Sugerencias para el autocompletado de [[ en el editor. */
export async function linkSuggestions(query: string): Promise<{ title: string; type: LinkTarget['type'] }[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const uid = user.id
    const pattern = `%${query.trim().replace(/[%_]/g, m => `\\${m}`)}%`

    const [notes, objectives, tasks, books] = await Promise.all([
        supabase.from('notes').select('title').eq('user_id', uid).ilike('title', pattern).order('updated_at', { ascending: false }).limit(6),
        supabase.from('objectives').select('title').eq('user_id', uid).eq('status', 'Active').ilike('title', pattern).limit(4),
        supabase.from('tasks').select('title').eq('user_id', uid).in('status', ['Todo', 'InProgress']).ilike('title', pattern).limit(4),
        supabase.from('books').select('title').eq('user_id', uid).ilike('title', pattern).limit(3)
    ])

    const seen = new Set<string>()
    const out: { title: string; type: LinkTarget['type'] }[] = []
    const push = (rows: any[] | null, type: LinkTarget['type']) => {
        for (const r of rows || []) {
            const k = String(r.title).toLowerCase()
            if (seen.has(k)) continue
            seen.add(k)
            out.push({ title: r.title, type })
        }
    }
    push(notes.data, 'note')
    push(objectives.data, 'objective')
    push(tasks.data, 'task')
    push(books.data, 'book')
    return out.slice(0, 10)
}

/**
 * Resaltado del lector → nota del libro ("Resaltados — <título>").
 * Cada cita queda con su página para volver a encontrarla.
 */
export async function addBookHighlight(bookId: string, text: string, page: number): Promise<ActionResult<{ noteId: string }>> {
    return runAction('addBookHighlight', async () => {
        const { supabase, user } = await requireUser()
        const quote = text.replace(/\s+/g, ' ').trim()
        if (!quote) throw new Error('No hay texto para guardar.')

        const { data: book } = await supabase.from('books').select('id, title, author').eq('id', bookId).eq('user_id', user.id).maybeSingle()
        if (!book) throw new Error('No encontré el libro.')

        const line = `> ${quote}\n> — pág ${page}`
        const { data: existing, error: findError } = await supabase
            .from('notes')
            .select('id, content')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .eq('source', 'highlight')
            .maybeSingle()
        if (findError) throw new Error(isMissingTable(findError) ? MISSING_MSG : findError.message)

        if (existing) {
            const { error } = await supabase
                .from('notes')
                .update({ content: `${existing.content.trim()}\n\n${line}`, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            if (error) throw error
            revalidatePath('/notas')
            return { noteId: existing.id }
        }

        const { data, error } = await supabase
            .from('notes')
            .insert({
                user_id: user.id,
                title: `Resaltados — ${book.title}`,
                content: `Libro: [[${book.title}]]${book.author ? ` · ${book.author}` : ''}\n\n${line}`,
                tags: ['lectura'],
                source: 'highlight',
                book_id: bookId
            })
            .select('id')
            .single()
        if (error) throw new Error(isMissingTable(error) ? MISSING_MSG : error.message)
        revalidatePath('/notas')
        return { noteId: data.id }
    })
}
