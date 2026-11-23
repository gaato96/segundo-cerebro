import { getIdeas, getArchivedNotes } from '@/lib/actions/ideas'
import { IdeasClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [ideas, archived, params] = await Promise.all([
        getIdeas(),
        getArchivedNotes(),
        searchParams
    ])

    return <IdeasClient initialIdeas={ideas} archivedNotes={archived} initialTab={params.tab === 'archivo' ? 'archivo' : 'banco'} />
}
