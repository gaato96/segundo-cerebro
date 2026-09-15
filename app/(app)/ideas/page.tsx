import { getIdeas, getArchivedNotes } from '@/lib/actions/ideas'
import { IdeasClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function IdeasPage() {
    const [ideas, archived] = await Promise.all([
        getIdeas(),
        getArchivedNotes()
    ])

    return <IdeasClient initialIdeas={ideas} archivedNotes={archived} />
}
