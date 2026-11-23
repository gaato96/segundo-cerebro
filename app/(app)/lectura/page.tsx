import { getBooks, getLinkableMediaBooks, getPendingBooks } from '@/lib/actions/books'
import { LibraryClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function LecturaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [books, linkable, pending, params] = await Promise.all([
        getBooks(),
        getLinkableMediaBooks(),
        getPendingBooks(),
        searchParams
    ])

    return (
        <LibraryClient
            books={books}
            linkable={linkable}
            pending={pending}
            initialTab={params.tab === 'leidos' ? 'leidos' : params.tab === 'pendientes' ? 'pendientes' : 'leyendo'}
        />
    )
}
