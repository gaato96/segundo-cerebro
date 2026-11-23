import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Destino de "Compartir" del celular (share_target del manifest).
 * Lo que llega (texto, título, link) cae al Inbox y se clasifica después.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const parts = [params.get('title'), params.get('text'), params.get('url')]
        .map(p => (p || '').trim())
        .filter(Boolean)
    // Muchas apps mandan el link también dentro del texto: no duplicarlo.
    const unique = parts.filter((p, i) => !parts.some((q, j) => j !== i && q.length > p.length && q.includes(p)))
    const content = Array.from(new Set(unique)).join('\n')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', request.url))

    if (content) {
        const row: Record<string, unknown> = { user_id: user.id, content, is_processed: false, source: 'share' }
        const { error } = await supabase.from('mental_notes').insert(row)
        if (error) {
            delete row.source
            await supabase.from('mental_notes').insert(row)
        }
    }

    return NextResponse.redirect(new URL(content ? '/inbox?compartido=1' : '/inbox', request.url))
}
