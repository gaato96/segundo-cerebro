import { getBooks, getLinkableMediaBooks } from '@/lib/actions/books'
import { LibraryClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function LecturaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [books, linkable, params] = await Promise.all([
        getBooks(),
        getLinkableMediaBooks(),
        searchParams
    ])

    return (
        <LibraryClient
            books={books}
            linkable={linkable}
            initialTab={params.tab === 'leidos' ? 'leidos' : 'leyendo'}
        />
    )
}
