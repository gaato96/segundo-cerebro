import { getBooks, getLinkableMediaBooks, getPendingBooks, getReadWithoutPdf } from '@/lib/actions/books'
import { LibraryClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function LecturaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [books, linkable, pending, read, params] = await Promise.all([
        getBooks(),
        getLinkableMediaBooks(),
        getPendingBooks(),
        getReadWithoutPdf(),
        searchParams
    ])

    return (
        <LibraryClient
            books={books}
            linkable={linkable}
            pending={pending}
            read={read}
            initialTab={params.tab === 'leidos' ? 'leidos' : params.tab === 'pendientes' ? 'pendientes' : 'leyendo'}
        />
    )
}
